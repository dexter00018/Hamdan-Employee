'use client';

import ModalShell from '@/components/shared/ModalShell';
import EmptyState from '@/components/shared/EmptyState';

type Props = {
  open: boolean;
  onClose: () => void;
  notifications: any[];
  unreadCount: number;
  readIds: string[];
  onMarkAllRead: () => void;
  onOpenNotification: (notification: any) => void;
};

export default function NotificationsModal({ open, onClose, notifications, unreadCount, readIds, onMarkAllRead, onOpenNotification }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="Notifications" description={`${unreadCount} unread`} icon="🔔" size="md">
      <div className="mb-3 flex justify-end">
        {notifications.length > 0 && (
          <button type="button" onClick={onMarkAllRead} className="min-h-11 rounded-full px-4 text-xs font-bold text-blue-600 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/50">
            Mark all as read
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications yet" description="Updates from HR will appear here." />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const isUnread = !readIds.includes(notification.id);
            return (
              <button key={notification.id} type="button" onClick={() => onOpenNotification(notification)} className={`w-full min-h-16 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isUnread ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${isUnread ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} aria-label={isUnread ? 'Unread' : 'Read'} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-slate-950 dark:text-white">{notification.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{notification.message}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}
