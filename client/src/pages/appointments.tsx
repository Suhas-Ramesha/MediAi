import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, FileText, ExternalLink } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { waitingWindowEscalation } from "@shared/mediai/intake";

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
  const { currentUser, userProfile, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [showDebugView, setShowDebugView] = useState(false);
  const [waitText, setWaitText] = useState("");

  // Redirect to landing page if not logged in
  useEffect(() => {
    if (!isLoading && !currentUser) {
      setLocation("/");
    }
  }, [isLoading, currentUser, setLocation]);

  // Load appointments from both localStorage and Firestore
  useEffect(() => {
    const loadAppointments = async () => {
      if (!currentUser) return;
      
      try {
        setIsLoadingAppointments(true);
        
        // Get appointments from localStorage - check both possible keys
        let localAppointments = JSON.parse(localStorage.getItem('mediaiAppointments') || '[]');
        
        // Log what we found in localStorage for debugging
        console.log('LocalStorage appointments:', localAppointments);
        
        // If no appointments found, check localStorage for pending appointments that might be saved differently
        if (localAppointments.length === 0) {
          // Try to look for other storage keys that might contain appointments
          const allKeys = Object.keys(localStorage);
          const appointmentKeys = allKeys.filter(key => 
            key.includes('appointment') || 
            key.includes('doctor') || 
            key.includes('booking')
          );
          
          console.log('Potential appointment keys found:', appointmentKeys);
          
          // Try to parse each potential appointment key
          for (const key of appointmentKeys) {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '[]');
              if (Array.isArray(data) && data.length > 0) {
                console.log(`Found appointments in key ${key}:`, data);
                localAppointments = localAppointments.concat(data);
              } else if (data && typeof data === 'object') {
                console.log(`Found appointment object in key ${key}:`, data);
                localAppointments.push(data);
              }
            } catch (e) {
              console.log(`Could not parse key ${key}`);
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
        // console.log('Firestore appointments:', firestoreAppointments);
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
          console.log('Checking consultation for appointments:', doc.id);

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
              console.log('Found potential appointment message:', msg); // Log candidates

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
        
        console.log('Appointments extracted from consultations:', appointmentsFromConsultations);
        
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
        
        console.log('Combined appointments:', allAppointments);
        
        // Check for approved appointments in sessionStorage
        // (created by notifications from MedicalChat component)
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('appointment_approved_')) {
            const appointmentId = key.replace('appointment_approved_', '');
            const appointmentIndex = allAppointments.findIndex(a => a.id === appointmentId);
            
            if (appointmentIndex >= 0) {
              // Mark this appointment as approved
              allAppointments[appointmentIndex].status = 'approved';
              console.log(`Marked appointment ${appointmentId} as approved`);
            }
          }
        });
        
        // Add demo appointments if no appointments found (for testing)
        if (allAppointments.length === 0) {
          console.log('No appointments found. This seems strange if you booked appointments. The data may be stored in an unexpected format.');
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

  // Show loading state if authentication is still loading
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Redirect if no user is logged in
  if (!currentUser) {
    return <div className="flex items-center justify-center min-h-screen">Redirecting...</div>;
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
      console.warn('Error formatting date:', dateStr, e);
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
      console.warn('Error formatting time:', timeStr, e);
      return timeStr;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500">Completed</Badge>;
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
    
    // Log if we're using default values
    if (formattedAppointment.doctorName === 'Doctor') {
      console.warn('Using default doctor name for appointment:', appointment);
    }
    if (formattedAppointment.date === 'Unknown Date') {
      console.warn('Using default date for appointment:', appointment);
    }
    if (formattedAppointment.time === 'Unknown Time') {
      console.warn('Using default time for appointment:', appointment);
    }
    
    return formattedAppointment;
  };

  // Toggle debug view
  const toggleDebugView = () => {
    setShowDebugView(!showDebugView);
  };
  
  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen flex flex-col text-slate-800 dark:text-slate-200">
      <Header user={headerUser} />
      
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Appointments</h1>
          <div className="flex gap-2">
            <Button
              onClick={() => setLocation('/dashboard')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Chat with MediAI
            </Button>
            <Button
              onClick={toggleDebugView}
              variant={showDebugView ? "default" : "secondary"}
              size="sm"
            >
              {showDebugView ? "Hide Debug Info" : "Debug View"}
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Something new while you wait?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Clinic apps remind you of the slot. This check uses the days until
              that slot plus what you type now. A red flag is never held back
              because the booking is soon.
            </p>
            <textarea
              className="min-h-20 w-full rounded-xl border border-input bg-background p-3 text-sm"
              value={waitText}
              onChange={(e) => setWaitText(e.target.value)}
              placeholder="e.g. sudden chest pain this morning"
            />
            {waitText.trim() && (() => {
              const upcoming = appointments
                .map((a) => Date.parse(a.date))
                .filter((n) => Number.isFinite(n) && n > Date.now());
              const daysOut = upcoming.length
                ? Math.max(
                    0,
                    Math.round((Math.min(...upcoming) - Date.now()) / 86400000),
                  )
                : 12;
              const esc = waitingWindowEscalation({
                newText: waitText,
                appointmentDaysOut: daysOut,
              });
              return esc.escalate ? (
                <p className="text-sm text-destructive">
                  Red flag: {esc.flags.join(", ")}. Do not wait for the booked
                  slot ({daysOut} days out). Seek urgent care.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No listed red flag in that text. Slot used for the window:{" "}
                  {daysOut} days. This is not a diagnosis.
                </p>
              );
            })()}
          </CardContent>
        </Card>
        
        {isLoadingAppointments ? (
          <Card>
            <CardContent className="p-8 flex justify-center">
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 border-4 border-t-primary rounded-full animate-spin mb-2"></div>
                <p>Loading your appointments...</p>
              </div>
            </CardContent>
          </Card>
        ) : appointments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No appointments found</h3>
                <p className="text-muted-foreground mb-4">
                  You don't have any appointments booked through MediAI yet.
                </p>
                <Button onClick={() => setLocation('/dashboard')}>
                  Book an Appointment
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {showDebugView && (
              <Card className="mb-4 overflow-hidden">
                <CardHeader>
                  <CardTitle>Debug Information</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-md overflow-auto max-h-96">
                    <pre className="text-xs">{JSON.stringify(appointments, null, 2)}</pre>
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <h4 className="text-sm font-bold mb-2">LocalStorage Keys:</h4>
                      <pre className="text-xs">{JSON.stringify(Object.keys(localStorage), null, 2)}</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="space-y-4">
              {appointments.map((appointment, index) => {
                // Ensure all appointment fields exist
                const completeAppointment = ensureAppointmentFields(appointment);
                
                return (
                  <Card key={completeAppointment.id || index} className="overflow-hidden">
                    <div className="flex flex-col sm:flex-row">
                      <div className="p-4 sm:p-6 flex-1">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-medium text-lg mb-1">
                              Appointment with Dr. {completeAppointment.doctorName}
                            </h3>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(completeAppointment.date)}</span>
                              <Clock className="h-4 w-4 ml-2" />
                              <span>{formatTime(completeAppointment.time)}</span>
                            </div>
                          </div>
                          <div>
                            {getStatusBadge(completeAppointment.status)}
                          </div>
                        </div>
                        
                        {completeAppointment.reason && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium mb-1">Reason</h4>
                            <p className="text-sm text-muted-foreground">
                              {completeAppointment.reason}
                            </p>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-2 mt-4">
                          {/* REMOVED: Join Video Call button */}
                          {/* {completeAppointment.status === 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => window.open('https://meet.google.com', '_blank')}
                            >
                              Join Video Call
                            </Button>
                          )} */}
                          
                          {/* REMOVED: View Details button */}
                          {/* <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                          >
                            View Details
                          </Button> */}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>
      
      <Footer />
    </div>
  );
} 