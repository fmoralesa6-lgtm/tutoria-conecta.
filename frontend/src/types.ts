export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
  role: "student" | "tutor" | "admin";
  onboarding: boolean;
  approved: boolean;
  suspended: boolean;
  suspension_reason?: string;
  suspended_at?: string;
  phone?: string;
  gender?: string;
  address?: string;
  lat: number;
  lng: number;
  portfolio?: string;
  bio?: string;
  hourly_rate?: number;
  has_document?: boolean;
}
export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  active: boolean;
}
export interface Offer {
  id: string;
  tutor_id: string;
  category_id: string;
  title: string;
  description: string;
  modalities: string[];
  hourly_rate: number;
  km_rate: number;
  active: boolean;
  name: string;
  picture: string;
  bio: string;
  rating: number;
  review_count: number;
  distance_km: number;
  category: string;
}
export interface Block {
  weekday: number;
  start_min: number;
  end_min: number;
}
export interface Session {
  id: string;
  subscription_id: string;
  tutor_id: string;
  student_id: string;
  title: string;
  tutor_name: string;
  student_name: string;
  start_at: string;
  end_at: string;
  status: string;
  absence_party?: "student" | "tutor" | "both" | "technical" | null;
  absence_details?: string | null;
  modality: string;
  class_cost: number;
  travel_cost: number;
  weeks: number;
  review_id: string | null;
}
export interface Review {
  stars: number;
  comment: string;
  created_at: string;
  name: string;
}
export interface Conversation {
  id: string;
  student_id: string;
  tutor_id: string;
  student_name: string;
  tutor_name: string;
}
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  attachments?: ChatAttachment[];
}
export interface ChatAttachment {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}
export interface Report {
  id: string;
  reporter_id: string;
  target_id: string;
  reason: string;
  evidence: string;
  status: string;
  resolution: string;
  created_at: string;
  reporter_name?: string;
  target_name?: string;
}
export interface Appeal {
  id: string;
  user_id: string;
  body: string;
  status: string;
  resolution: string;
  created_at: string;
  name?: string;
}
export interface Audit {
  id: string;
  action: string;
  target: string;
  created_at: string;
  detail: unknown;
}
export interface Metrics {
  rankings: { id: string; name: string; rating: number; reviews: number }[];
  demand: { name: string; hours: number }[];
  sessions: { status: string; total: number }[];
}
export interface Quote {
  sessions: number;
  distance_km: number;
  class_cost: number;
  travel_cost: number;
  total: number;
  route: number[][] | null;
  notice: string;
}