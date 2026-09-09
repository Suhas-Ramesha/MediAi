import { useEffect, useState } from 'react';
import { Consultation } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { MessageSquare, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface RecentConsultationsProps {
  consultations: Consultation[];
  onSelectChat?: (consultation: Consultation) => void;
}

export default function RecentConsultations({ consultations: propConsultations, onSelectChat }: RecentConsultationsProps) {
  const { currentUser } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setConsultations([]);
      setIsLoading(false);
      return;
    }

    try {
      const consultationsRef = collection(db, 'consultations');
      const q = query(
        consultationsRef,
        where('userId', '==', currentUser.uid),
        orderBy('lastUpdated', 'desc'),
        limit(5)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedConsultations = snapshot.docs.map(doc => {
          const data = doc.data();

          let consultationDate = new Date();
          if (data.lastUpdated) {
            consultationDate = (data.lastUpdated as Timestamp).toDate();
          } else if (data.date) {
            consultationDate = (data.date as Timestamp).toDate();
          }

          const messages = (data.messages || []).map((msg: any) => ({
            ...msg,
            timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp
          }));

          return {
            id: doc.id,
            chatId: data.chatId || doc.id,
            title: data.title || `Chat ${format(consultationDate, 'PPP')}`,
            date: consultationDate,
            status: data.status || 'completed',
            userId: data.userId,
            messages: messages,
            symptoms: data.symptoms || '',
            diagnosis: data.diagnosis || '',
            recommendations: data.recommendations || ''
          } as Consultation;
        });

        setConsultations(fetchedConsultations);
        setIsLoading(false);
      }, () => {
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch {
      setIsLoading(false);
    }
  }, [currentUser]);

  const handleChatClick = (consultation: Consultation) => {
    if (onSelectChat) {
      onSelectChat(consultation);
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const getLastMessage = (consultation: Consultation) => {
    if (consultation.messages && consultation.messages.length > 0) {
      const lastMessage = consultation.messages[consultation.messages.length - 1];
      const preview = lastMessage.content.slice(0, 60);
      return preview + (lastMessage.content.length > 60 ? '...' : '');
    }
    return consultation.symptoms ? consultation.symptoms.slice(0, 60) + '...' : 'No messages';
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return format(date, 'MMM d, yyyy');
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="text-sm font-semibold">Recent chats</h2>
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Recent chats
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({consultations.length})
          </span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
          className="h-8 px-2"
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>
      {!isCollapsed && (
        <div className="mt-3">
          {consultations.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No recent chats</p>
          ) : (
            <div className="space-y-2">
              {consultations.map((consultation) => (
                <div
                  key={consultation.id}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <button
                    type="button"
                    onClick={() => handleChatClick(consultation)}
                    className="w-full p-3 text-left transition-colors duration-fast hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <h3 className="truncate text-sm font-medium">
                          {consultation.title}
                        </h3>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          consultation.status === "completed"
                            ? "bg-success/15 text-success"
                            : consultation.status === "active"
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {consultation.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeAgo(consultation.date)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {getLastMessage(consultation)}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
