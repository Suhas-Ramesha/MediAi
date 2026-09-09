import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Calendar, Clock } from "lucide-react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

import { useRequireAuth } from "@/hooks/use-auth";
import { AppShell, PageSkeleton } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";

interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  status: string;
  reason: string;
  createdAt: string;
}

export default function Appointments() {
  const { currentUser, userProfile, isLoading } = useRequireAuth();
  const [, setLocation] = useLocation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);

  // Load appointments from both localStorage and Firestore
  useEffect(() => {
    const loadAppointments = async () => {
      if (!currentUser) return;
      
      try {
        setIsLoadingAppointments(true);
        
        // Get appointments from localStorage - check both possible keys
        let localAppointments = JSON.parse(localStorage.getItem('mediaiAppointments') || '[]');
        
        // If no appointments found, check localStorage for pending appointments that might be saved differently
        if (localAppointments.length === 0) {
          // Try to look for other storage keys that might contain appointments
          const allKeys = Object.keys(localStorage);
          const appointmentKeys = allKeys.filter(key => 
            key.includes('appointment') || 
            key.includes('doctor') || 
            key.includes('booking')
          );
          
          // Try to parse each potential appointment key
          for (const key of appointmentKeys) {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '[]');
              if (Array.isArray(data) && data.length > 0) {
                localAppointments = localAppointments.concat(data);
              } else if (data && typeof data === 'object') {
                localAppointments.push(data);
              }
            } catch (e) {
            }
          }
        }
        
        // Then, try to get appointments from Firestore
        // REMOVED: This query fails due to updated Firestore rules.
        // const appointmentsRef = collection(db, 'users', currentUser.uid, 'appointments');
        // const q = query(appointmentsRef, orderBy('createdAt', 'desc'));
        // const snapshot = await getDocs(q);
        //
        // const firestoreAppointments = snapshot.docs.map(doc => {
        //   const data = doc.data();
        //   return {
        //     id: doc.id,
        //     doctorId: data.doctorId,
        //     doctorName: data.doctorName,
        //     date: data.date,
        //     time: data.time,
        //     status: data.status,
        //     reason: data.reason,
        //     createdAt: data.createdAt
        //   };
        // });
        //
        const firestoreAppointments: Appointment[] = []; // Initialize as empty array since we removed the query
        
        // Also check consultations for appointment records
        const consultationsRef = collection(db, 'consultations');
        const consultationsQuery = query(
          consultationsRef,
          where('userId', '==', currentUser.uid),
          orderBy('lastUpdated', 'desc')
        );
        
        const consultationsSnapshot = await getDocs(consultationsQuery);
        const appointmentsFromConsultations: Appointment[] = [];
        
        consultationsSnapshot.forEach(doc => {
          const data = doc.data();

          // Use structured fields if available
          const structuredDoctorName = data.doctorName || (data.selectedDoctor && (data.selectedDoctor.name || (data.selectedDoctor.firstName ? data.selectedDoctor.firstName + ' ' + data.selectedDoctor.lastName : 'Doctor')));
          const structuredDate = data.appointmentDate || (data.selectedSlot && (data.selectedSlot.date || data.selectedSlot.appointmentDate));
          const structuredTime = data.appointmentTime || (data.selectedSlot && (data.selectedSlot.time || data.selectedSlot.startTime));

          // Check if messages contain appointment information
          if (data.messages && Array.isArray(data.messages)) {
            // Find appointment messages more reliably
            const appointmentMessages = data.messages.filter((msg: any) => {
              // Priority 1: Message has a specific appointmentId
              if (msg.appointmentId) {
                return true;
              }
              // Priority 2: Assistant message confirming/updating an appointment
              if (msg.role === 'assistant' && msg.content) {
                 // Check for confirmation keywords OR the update flag
                 const isConfirmation = msg.content.toLowerCase().includes('approved') || 
                                      msg.content.toLowerCase().includes('confirmed');
                 if (isConfirmation || msg.isAppointmentUpdate) {
                   return true;
                 }
              }
              return false; // Ignore other messages (like user requests)
            });

            for (const msg of appointmentMessages) {


              // Attempt extraction primarily if appointmentId exists, 
              // or if it's a confirmation message (though ID is preferred)
              if (msg.appointmentId || (msg.role === 'assistant' && (msg.content?.toLowerCase().includes('approved') || msg.content?.toLowerCase().includes('confirmed') || msg.isAppointmentUpdate))) {
                // Use structured fields if available, fallback to message extraction
                let doctorName = structuredDoctorName || 'Unknown Doctor';
                let date = structuredDate || '';
                let time = structuredTime || '';
                // If still missing, try to extract from message content
                if (!doctorName || doctorName === 'Doctor' || doctorName === 'Unknown Doctor') {
                  const content = msg.content || '';
                  const doctorMatch = content.match(/Dr\.?\s+([A-Za-z\s]+)/);
                  if (doctorMatch) {
                    doctorName = doctorMatch[1].trim();
                  }
                }
                if (!date || !time) {
                  const content = msg.content || '';
                  const dateTimeMatch = content.match(/for\s+([A-Za-z0-9,\s-]+)\s+at\s+([0-9:]+\s*[APMapm]*)/);
                  if (dateTimeMatch) {
                    date = dateTimeMatch[1].trim();
                    time = dateTimeMatch[2].trim();
                  }
                }
                // Determine status
                let status = 'pending';
                const content = msg.content || '';
                if (content.toLowerCase().includes('approved') || 
                    content.toLowerCase().includes('confirmed') ||
                    msg.isAppointmentUpdate) {
                  status = 'approved';
                }
                appointmentsFromConsultations.push({
                  id: msg.appointmentId,
                  doctorId: data.doctorId || '',
                  doctorName,
                  date,
                  time,
                  status,
                  reason: data.symptoms || 'Consultation',
                  createdAt: msg.timestamp || new Date().toISOString()
                });
              }
            }
          }
        });
        
        
        // Combine all sources, removing duplicates by ID
        const allAppointments = [...localAppointments];
        
        // Add Firestore appointments that aren't already in the list
        // REMOVED: No need to merge firestoreAppointments if the query is removed
        // firestoreAppointments.forEach(firestoreAppt => {
        //   if (!allAppointments.some(appt => appt.id === firestoreAppt.id)) {
        //     allAppointments.push(firestoreAppt);
        //   }
        // });
        
        // Add appointments from consultations that aren't already in the list
        appointmentsFromConsultations.forEach(consultationAppt => {
          if (!allAppointments.some(appt => appt.id === consultationAppt.id)) {
            allAppointments.push(consultationAppt);
          }
        });
        
        
        // Check for approved appointments in sessionStorage
        // (created by notifications from MedicalChat component)
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('appointment_approved_')) {
            const appointmentId = key.replace('appointment_approved_', '');
            const appointmentIndex = allAppointments.findIndex(a => a.id === appointmentId);
            
            if (appointmentIndex >= 0) {
              // Mark this appointment as approved
              allAppointments[appointmentIndex].status = 'approved';
            }
          }
        });
        
        // Add demo appointments if no appointments found (for testing)
        if (allAppointments.length === 0) {
        }
        
        // Sort by date (newest first)
        allAppointments.sort((a, b) => {
          const dateA = new Date(a.createdAt || '');
          const dateB = new Date(b.createdAt || '');
          return dateB.getTime() - dateA.getTime();
        });
        
        setAppointments(allAppointments);
      } catch (error) {
        console.error("Error loading appointments:", error);
      } finally {
        setIsLoadingAppointments(false);
      }
    };
    
    loadAppointments();
  }, [currentUser]);

  if (isLoading || !currentUser) {
    return <PageSkeleton />;
  }

  const headerUser = {
    name: userProfile?.name || "User",
    email: userProfile?.email || "",
    profileImage: userProfile?.photoURL || undefined
  };
  
  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr || dateStr === 'Unknown Date') return dateStr;
      
      // Try to parse the date string
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // If it's not a valid date string, try to extract date parts
        const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) {
          return new Date(dateMatch[0]).toLocaleDateString(undefined, { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        }
        return dateStr;
      }
      
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateStr;
    }
  };
  
  const formatTime = (timeStr: string) => {
    try {
      if (!timeStr || timeStr === 'Unknown Time') return timeStr;
      
      // Try to parse the time string
      const timeMatch = timeStr.match(/(\d{1,2}:\d{2}\s*[APap][mM])|(\d{1,2}:\d{2})/);
      if (timeMatch) {
        return timeMatch[0].toUpperCase();
      }
      return timeStr;
    } catch (e) {
      return timeStr;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'approved':
        return <Badge className="border-transparent bg-success/15 text-success">Approved</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-border text-muted-foreground">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'completed':
        return <Badge className="border-transparent bg-primary/15 text-primary">Completed</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };
  
  // Add missing fields to appointment with defaults
  const ensureAppointmentFields = (appointment: any): Appointment => {
    const formattedAppointment = {
      id: appointment.id || appointment.appointmentId || String(Date.now()),
      doctorId: appointment.doctorId || '',
      doctorName: appointment.doctorName || (appointment.firstName ? `${appointment.firstName} ${appointment.lastName}` : 'Doctor'),
      date: appointment.date || appointment.appointmentDate || 'Unknown Date',
      time: appointment.time || appointment.startTime || 'Unknown Time',
      status: appointment.status || 'pending',
      reason: appointment.reason || 'Medical Consultation',
      createdAt: appointment.createdAt || new Date().toISOString()
    };
    
    return formattedAppointment;
  };

  return (
    <AppShell
      user={headerUser}
      wide
      title="Appointments"
      description="Bookings made from a consultation stay on this list."
    >
      <div className="mb-6 flex justify-end">
        <Button variant="outline" onClick={() => setLocation("/dashboard")}>
          Open a consultation
        </Button>
      </div>

      {isLoadingAppointments ? (
        <div className="space-y-3">
          <div className="surface h-28 animate-pulse bg-muted/40" />
          <div className="surface h-28 animate-pulse bg-muted/40" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="surface flex flex-col items-center px-6 py-16 text-center">
          <Calendar className="mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No appointments yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            When a chat suggests you should be seen, you can book from there.
            Those bookings appear here.
          </p>
          <Button className="mt-5" onClick={() => setLocation("/dashboard")}>
            Start a consultation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment, index) => {
            const completeAppointment = ensureAppointmentFields(appointment);
            return (
              <article
                key={completeAppointment.id || index}
                className="surface p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">
                      Dr. {completeAppointment.doctorName}
                    </h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(completeAppointment.date)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(completeAppointment.time)}
                      </span>
                    </p>
                  </div>
                  {getStatusBadge(completeAppointment.status)}
                </div>
                {completeAppointment.reason ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {completeAppointment.reason}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
} 