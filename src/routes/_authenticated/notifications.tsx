import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/notification.functions";
import { formatDateTime } from "@/lib/format";
import { Bell, CheckCheck } from "lucide-react";

const notifQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: () => getMyNotifications(),
  refetchInterval: 10000, // Poll every 10s for new notifications
});

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — OBS" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(notifQuery),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data } = useSuspenseQuery(notifQuery);
  const queryClient = useQueryClient();
  const doMarkRead = useServerFn(markNotificationRead);
  const doMarkAll = useServerFn(markAllNotificationsRead);

  const unreadCount = data.notifications.filter((n) => !n.read).length;

  async function handleMarkAll() {
    await doMarkAll();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleMarkRead(id: string) {
    await doMarkRead({ data: { notification_id: id } });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Notifications</h1>
          <p className="mt-1 text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAll}>
            <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {data.notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Bell className="h-10 w-10 opacity-30" />
            <p>No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.notifications.map((n) => (
            <Card
              key={n.id}
              className={`cursor-pointer transition-colors ${!n.read ? "border-primary/30 bg-primary/5" : ""}`}
              onClick={() => !n.read && handleMarkRead(n.id)}
            >
              <CardContent className="flex items-start gap-3 py-3">
                <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!n.read ? "bg-primary" : "bg-transparent"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/60">{n.channel}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
