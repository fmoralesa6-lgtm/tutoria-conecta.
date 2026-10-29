CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), google_sub text UNIQUE NOT NULL, email text UNIQUE NOT NULL, name text NOT NULL, picture text NOT NULL DEFAULT '',
 role text NOT NULL DEFAULT 'student' CHECK(role IN ('student','tutor','admin')), onboarding boolean NOT NULL DEFAULT false, approved boolean NOT NULL DEFAULT false,
 suspended boolean NOT NULL DEFAULT false, suspension_reason text, suspended_at timestamptz, phone text, gender text, address text, lat double precision, lng double precision, document_cipher text,
 affinities jsonb NOT NULL DEFAULT '[]', portfolio text, bio text, hourly_rate numeric(10,2), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL UNIQUE,parent_id uuid REFERENCES categories(id),active boolean NOT NULL DEFAULT true,CHECK(parent_id IS NULL OR parent_id<>id));
CREATE TABLE IF NOT EXISTS offers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tutor_id uuid NOT NULL REFERENCES users(id),category_id uuid NOT NULL REFERENCES categories(id),title text NOT NULL,description text NOT NULL,modalities jsonb NOT NULL, hourly_rate numeric(10,2) NOT NULL CHECK(hourly_rate>0),km_rate numeric(10,2) NOT NULL DEFAULT 0 CHECK(km_rate>=0),active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS availability(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tutor_id uuid NOT NULL REFERENCES users(id),weekday int NOT NULL CHECK(weekday BETWEEN 0 AND 6),start_min int NOT NULL,end_min int NOT NULL,CHECK(start_min>=0 AND end_min<=1440 AND end_min>start_min));
CREATE TABLE IF NOT EXISTS subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES users(id),offer_id uuid NOT NULL REFERENCES offers(id),weeks int NOT NULL CHECK(weeks IN (1,4,8)),modality text NOT NULL CHECK(modality IN ('virtual','tutor_home','student_home')),class_cost numeric(12,2) NOT NULL,travel_cost numeric(12,2) NOT NULL,distance_km numeric(10,3) NOT NULL,route jsonb,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','cancelled')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),subscription_id uuid NOT NULL REFERENCES subscriptions(id),tutor_id uuid NOT NULL REFERENCES users(id),student_id uuid NOT NULL REFERENCES users(id),start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','completed','not_held','cancelled')),absence_party text,absence_details text,CHECK(end_at>start_at),CHECK(tutor_id<>student_id));
CREATE TABLE IF NOT EXISTS session_slots(session_id uuid NOT NULL REFERENCES sessions(id),user_id uuid NOT NULL REFERENCES users(id),period tstzrange NOT NULL,PRIMARY KEY(session_id,user_id),EXCLUDE USING gist(user_id WITH =,period WITH &&));
CREATE TABLE IF NOT EXISTS conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES users(id),tutor_id uuid NOT NULL REFERENCES users(id),UNIQUE(student_id,tutor_id),CHECK(student_id<>tutor_id));
CREATE TABLE IF NOT EXISTS messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL REFERENCES conversations(id),sender_id uuid NOT NULL REFERENCES users(id),body text NOT NULL CHECK(length(body) BETWEEN 0 AND 2000),created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz);
CREATE TABLE IF NOT EXISTS reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL UNIQUE REFERENCES sessions(id),tutor_id uuid NOT NULL REFERENCES users(id),student_id uuid NOT NULL REFERENCES users(id),stars int NOT NULL CHECK(stars BETWEEN 1 AND 5),comment text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_id uuid NOT NULL REFERENCES users(id),target_id uuid NOT NULL REFERENCES users(id),reason text NOT NULL,evidence text NOT NULL,status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),resolution text,session_id uuid REFERENCES sessions(id),created_at timestamptz NOT NULL DEFAULT now(),CHECK(reporter_id<>target_id));
CREATE TABLE IF NOT EXISTS appeals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),body text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),resolution text,created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_appeal ON appeals(user_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid REFERENCES users(id),action text NOT NULL,target text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO categories(name) VALUES ('Idiomas'),('Deportes'),('Ciencias'),('Tecnología'),('Posgrado') ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS sessions_tutor ON sessions(tutor_id,start_at);
CREATE INDEX IF NOT EXISTS sessions_student ON sessions(student_id,start_at);
CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id,created_at);
CREATE TABLE IF NOT EXISTS course_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id),
  kind text NOT NULL CHECK (
    kind IN ('announcement','material','meeting')
  ),
  title text NOT NULL CHECK (
    char_length(title) BETWEEN 3 AND 160
  ),
  body text NOT NULL CHECK (
    char_length(body) BETWEEN 3 AND 6000
  ),
  url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind='announcement' OR url <> '')
);

CREATE INDEX IF NOT EXISTS course_posts_offer
ON course_posts(offer_id,created_at DESC);

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_weeks_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_weeks_check CHECK(weeks IN (1,4,8));

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS absence_party text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS absence_details text;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check CHECK(status IN ('pending','approved','completed','not_held','cancelled'));
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_absence_fields_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_absence_fields_check CHECK(
  (status='not_held' AND absence_party IN ('student','tutor','both','technical') AND length(trim(absence_details)) BETWEEN 10 AND 2000)
  OR (status<>'not_held' AND absence_party IS NULL AND absence_details IS NULL)
);

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_body_check;
ALTER TABLE messages ADD CONSTRAINT messages_body_check CHECK(length(body) BETWEEN 0 AND 2000);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id);
CREATE UNIQUE INDEX IF NOT EXISTS reports_one_per_session ON reports(session_id) WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS chat_attachments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES users(id),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880),
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_attachments_message ON chat_attachments(message_id);