export type Role = 'admin' | 'co-admin' | 'member';
export type MembershipStatus = 'pending' | 'approved' | 'rejected';
export type StudyBlockStatus = 'active' | 'idle';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  studyGoal?: string;
  createdAt: string;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface TimeSlot {
  startTime: string; // e.g. "07:00"
  endTime: string;   // e.g. "10:00"
}

export interface DaySchedule {
  day: DayKey;
  label: string;
  shortLabel: string;
  enabled: boolean;
  slots: TimeSlot[];
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  category: string;
  adminId: string;
  adminName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  dailyStartTime: string; // e.g. "06:00"
  dailyEndTime: string;   // e.g. "22:00"
  targetDailyHours: number; // e.g. 4
  schedule?: DaySchedule[]; // Multi-slot day-by-day customized schedule
  maxMembers: number;
  isPublic: boolean;
  bannerColor?: string;
  tags: string[];
  createdAt: string;
  memberCount?: number;
  userStatus?: MembershipStatus;
  userRole?: Role;
}


export interface CampaignMembership {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  campaignId: string;
  role: Role;
  status: MembershipStatus;
  joinedAt: string;
}

export interface StudyBlock {
  id: string;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  campaignId: string;
  campaignName?: string;
  timestamp: string; // ISO string
  durationMinutes: number; // default 5 min block
  status: StudyBlockStatus; // "active" | "idle"
  subjectNote?: string;
  snapshotUrl?: string; // Optional 5-min verified screen frame snapshot
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  campaignId?: string | null;
  recipientId?: string | null;
  content: string;
  attachmentUrl?: string | null;
  attachmentType?: 'image' | 'file' | null;
  createdAt: string;
  reactions?: MessageReaction[];
}

export interface CallParticipant {
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  socketId?: string;
  isMuted: boolean;
  isVideoOn?: boolean;
  isDeafened?: boolean;
  isScreenSharing: boolean;
  isSpeaking?: boolean;
  joinedAt: string;
  lastSeen?: string;
}

export interface CallSession {
  id: string;
  campaignId: string;
  campaignName?: string;
  startedAt: string;
  endedAt?: string | null;
  participants: CallParticipant[];
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  role: Role;
  todayMinutes: number;
  thisWeekMinutes: number;
  totalMinutes: number;
  activeStreakDays: number;
  lastActive?: string;
  targetDailyHours: number;
  todayTargetMet: boolean;
  rank?: number;
}

export interface LiveStudySession {
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  campaignId: string;
  campaignName: string;
  subjectNote: string;
  startedAt: string;
  activeMinutes: number;
  isScreenSharedLocally: boolean;
}
