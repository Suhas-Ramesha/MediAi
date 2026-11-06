import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  doc,
  getDoc
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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [expandedConsultation, setExpandedConsultation] = useState<string | null>(null);

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

          // Convert Firestore timestamps to dates
          let consultationDate = new Date();
          if (data.lastUpdated) {
            consultationDate = (data.lastUpdated as Timestamp).toDate();
          } else if (data.date) {
            consultationDate = (data.date as Timestamp).toDate();
          }

          // Convert message timestamps from ISO strings back to dates
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
      }, (error) => {
        console.error('Error in snapshot listener:', error);
        setIsLoading(false);
      });

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up consultations listener:', error);
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

  const toggleConsultation = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedConsultation(expandedConsultation === id ? null : id);
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex justify-between items-center">
            <span>Recent Chats</span>
            <Button variant="ghost" size="sm" disabled className="px-2 py-0 h-6">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-2">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="transition-all duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="flex justify-between items-center">
          <span>Recent Chats ({consultations.length})</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleCollapse}
            className="px-2 py-0 h-6"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="pt-0">
        {consultations.length === 0 ? (
            <div className="text-center py-2 text-muted-foreground">
            No recent chats
          </div>
        ) : (
            <div className="space-y-2">
            {consultations.map((consultation) => (
              <div
                key={consultation.id}
                  className="border border-slate-200 rounded-lg overflow-hidden transition-all duration-300 hover:border-slate-300"
                >
                  <div
                onClick={() => handleChatClick(consultation)}
                    className="p-3 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <h3 className="font-medium text-sm truncate">
                        {consultation.title}
                      </h3>
                    </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                    consultation.status === 'completed' 
                      ? 'bg-green-100 text-green-800' 
                      : consultation.status === 'active'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {consultation.status}
                  </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => toggleConsultation(consultation.id, e)}
                          className="p-0 h-6 w-6"
                        >
                          {expandedConsultation === consultation.id ? 
                            <ChevronDown className="h-3 w-3" /> : 
                            <ChevronRight className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeAgo(consultation.date)}</span>
                      <span className="text-xs">({consultation.messages.length} messages)</span>
                </div>
                
                    {expandedConsultation === consultation.id && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                  <p className="text-sm text-foreground/80">
                    {getLastMessage(consultation)}
                  </p>
                  {consultation.diagnosis && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Diagnosis:</span> {consultation.diagnosis.substring(0, 80)}
                            {consultation.diagnosis.length > 80 ? '...' : ''}
                    </p>
                  )}
                  {consultation.recommendations && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Recommendation:</span> {consultation.recommendations.substring(0, 80)}
                            {consultation.recommendations.length > 80 ? '...' : ''}
                    </p>
                  )}
                </div>
                    )}
                  </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}
