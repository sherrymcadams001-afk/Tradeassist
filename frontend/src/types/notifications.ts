export type NotificationPriority = "low" | "medium" | "high";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: string;
  icon: string;
  color: {
    from: string;
    to: string;
    border: string;
  };
  priority: NotificationPriority;
  timestamp: Date;
  symbol?: string;
}
