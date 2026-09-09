// TODO: Replace with your actual appointment API base URL
const API_BASE_URL = 'https://doctor-appointment-backend-7htx.onrender.com/api'; // Make sure this is correct!

// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem('appointment_auth_token');
};

// Helper function to create headers with auth token
const createAuthHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Function to check if user is authenticated for appointment system
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

/** Result of {@link fetchDoctors}; includes fallback metadata when the specialty filter matched nobody. */
export interface FetchDoctorsResult {
  doctors: any[];
  /** True when a specialty was requested, the filtered list was empty, and the unfiltered list was used instead. */
  specialtyFallback?: boolean;
  attemptedSpecialty?: string;
}

function normalizeDoctorsPayload(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.data)) return d.data;
    if (Array.isArray(d.doctors)) return d.doctors;
    if (Array.isArray(d.results)) return d.results;
    if (Array.isArray(d.items)) return d.items;
  }
  return [];
}

/** Single request to /doctors (optional specialty query). */
async function fetchDoctorsOnce(specialty?: string): Promise<any[]> {
  const url = specialty
    ? `${API_BASE_URL}/doctors?specialty=${encodeURIComponent(specialty)}`
    : `${API_BASE_URL}/doctors`;
  console.log(`Calling API URL: ${url}`);

  const response = await fetch(url, {
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`API Error ${response.status}: ${response.statusText}`, errorBody);
    throw new Error(`Failed to fetch doctors. Status: ${response.status}`);
  }

  const data = await response.json();
  console.log("Received doctors:", data);
  return normalizeDoctorsPayload(data);
}

/**
 * Fetches doctors. If a specialty hint is set but the directory has no matching doctors
 * (common after risk flow: e.g. "Hepatologist" while only "Cardiologist" exists), retries
 * without the filter so the first booking attempt still shows a list.
 */
export const fetchDoctors = async (specialty?: string): Promise<FetchDoctorsResult> => {
  const spec = specialty?.trim() || undefined;
  console.log(`Fetching REAL doctors... Specialty: ${spec ?? "(none)"}`);
  try {
    if (spec) {
      const filtered = await fetchDoctorsOnce(spec);
      if (filtered.length > 0) {
        return { doctors: filtered };
      }
      const all = await fetchDoctorsOnce(undefined);
      return {
        doctors: all,
        specialtyFallback: all.length > 0,
        attemptedSpecialty: spec,
      };
    }
    const all = await fetchDoctorsOnce(undefined);
    return { doctors: all };
  } catch (error) {
    console.error("Error in fetchDoctors:", error);
    throw error;
  }
};

// Function to fetch REAL availability from the API
export const fetchAvailability = async (doctorId: string): Promise<any[]> => {
  if (!doctorId) {
    console.error("Missing doctor ID");
    throw new Error("Doctor ID is required");
  }
  
  console.log(`Fetching REAL availability for doctor ${doctorId}...`);
  try {
    // Try the alternative format if your API expects a query parameter instead of path parameter
    // const url = `${API_BASE_URL}/availability?doctorId=${doctorId}`;
    
    // Standard RESTful format
    const url = `${API_BASE_URL}/doctors/${doctorId}/availability`;
    
    console.log(`Calling API URL: ${url}`);
    
    const response = await fetch(url, {
      headers: createAuthHeaders()
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error ${response.status}: ${response.statusText}`, errorBody);
      
      // Parse the error body to get more details
      let errorMessage = `Failed to fetch availability. Status: ${response.status}`;
      try {
        const parsedError = JSON.parse(errorBody);
        if (parsedError && parsedError.message) {
          errorMessage = `API Error: ${parsedError.message}`;
        }
      } catch (e) {
        // If JSON parsing fails, just use the original error
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Received availability:", data);
    
    // Handle both array responses and responses with a data property
    const slots = Array.isArray(data) ? data : (data.data || data.slots || data.availability || []);
    
    // If we got no slots, log it but return an empty array rather than throwing
    if (!slots.length) {
      console.log("No availability slots returned from API");
    }
    
    return slots; 
  } catch (error) {
    console.error("Error in fetchAvailability:", error);
    throw error;
  }
};

// Helper to check if a string is a valid MongoDB ObjectId format
const isValidMongoObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// Helper to format IDs correctly for the API
const formatIdForApi = (id: string, fieldName: string): string => {
  // Log for debugging
  console.log(`Formatting ID for ${fieldName}:`, id);
  
  // If it's already a valid MongoDB ObjectId, use it as is
  if (isValidMongoObjectId(id)) {
    return id;
  }
  
  // For patientId, we'll use a special prefix to indicate it's a non-MongoDB ID
  // This assumes the backend has been modified to handle these special IDs
  if (fieldName === 'patientId') {
    return `firebase_${id}`;
  }
  
  // For other IDs, return as is but log a warning
  console.warn(`Warning: ${fieldName} may not be a valid MongoDB ObjectId:`, id);
  return id;
};

// Function to register a patient with the appointment system
export const createPatient = async (patientData: any): Promise<any> => {
  console.log('Creating patient with data:', patientData);
  
  if (!patientData.name) {
    throw new Error("Patient name is required");
  }
  
  try {
    // Create a copy of the data
    const formattedData = { ...patientData };
    
    // API endpoint for patient creation
    const url = `${API_BASE_URL}/patients`;
    
    console.log(`Calling API URL: ${url}`);
    console.log(`Request method: POST`);
    console.log(`Request body:`, formattedData);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(formattedData)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error ${response.status}: ${response.statusText}`, errorBody);
      
      let errorMessage = `Failed to create patient. Status: ${response.status}`;
      try {
        const parsedError = JSON.parse(errorBody);
        if (parsedError && parsedError.message) {
          errorMessage = `API Error: ${parsedError.message}`;
        }
      } catch (e) {
        // If JSON parsing fails, just use the original error
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Patient creation response:", data);
    return data; // Return the response with patient ID
  } catch (error) {
    console.error("Error in createPatient:", error);
    throw error;
  }
};

// Function to find a patient by external ID (e.g., Firebase UID)
export const findPatientByExternalId = async (externalId: string): Promise<any> => {
  console.log('Finding patient with external ID:', externalId);
  
  try {
    // API endpoint for patient lookup by external ID
    const url = `${API_BASE_URL}/patients/external/${externalId}`;
    
    console.log(`Calling API URL: ${url}`);
    
    const response = await fetch(url, {
      headers: createAuthHeaders()
    });

    // If 404, patient doesn't exist, which is fine - we'll create one
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error ${response.status}: ${response.statusText}`, errorBody);
      
      let errorMessage = `Failed to find patient. Status: ${response.status}`;
      try {
        const parsedError = JSON.parse(errorBody);
        if (parsedError && parsedError.message) {
          errorMessage = `API Error: ${parsedError.message}`;
        }
      } catch (e) {
        // If JSON parsing fails, just use the original error
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Patient lookup response:", data);
    return data; // Return the patient data
  } catch (error) {
    console.error("Error in findPatientByExternalId:", error);
    // Don't throw here - we'll create a patient if not found
    return null;
  }
};

// Function to REALLY request an appointment through the API
export const requestAppointment = async (details: any): Promise<any> => {
  console.log('Requesting REAL appointment with data:', details);
  
  // Check for minimum required fields (adjust based on your API requirements)
  if (!details.doctorId) {
    throw new Error("doctorId is required for appointment booking");
  }
  
  // Make sure we have some form of date/time information
  if (!details.date && !details.dateTime) {
    throw new Error("Date information is required for appointment booking");
  }
  
  try {
    // Create a copy of the details to avoid modifying the original
    const formattedDetails = { ...details };
    
    // Format doctorId if needed (ensure it's a valid MongoDB ID)
    if (formattedDetails.doctorId) {
      formattedDetails.doctorId = formatIdForApi(formattedDetails.doctorId, 'doctorId');
    }
    
    // Direct approach: Embed patient information in the appointment request
    // This assumes the API will handle patient registration if needed
    
    // If we have the Firebase UID, pass it along in a way the API can recognize
    if (formattedDetails.externalPatientId) {
      formattedDetails.patientExternalId = formattedDetails.externalPatientId;
    }
    
    // Format slot ID if present
    if (formattedDetails.slotId) {
      formattedDetails.slotId = formatIdForApi(formattedDetails.slotId, 'slotId');
    }
    
    // Log what we're sending
    console.log("Appointment request payload:", JSON.stringify(formattedDetails, null, 2));
    
    // Direct call to the appointments endpoint
    const url = `${API_BASE_URL}/appointments`;
    
    console.log(`Calling API URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(formattedDetails)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error ${response.status}: ${response.statusText}`, errorBody);
      
      // Try to parse error for more details
      let errorMessage = `Failed to request appointment. Status: ${response.status}`;
      try {
        const parsedError = JSON.parse(errorBody);
        if (parsedError && parsedError.message) {
          errorMessage = `API Error: ${parsedError.message}`;
        }
      } catch (e) {
        // If JSON parsing fails, just use the original error
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Appointment request response:", data);
    return data; // Return the actual response from API
  } catch (error) {
    console.error("Error in requestAppointment:", error);
    throw error;
  }
};

const BOOKING_META_PREFIX = "mediai_appt_meta_";

/** Remember slot + doctor shown to the user; status API often omits date/time fields. */
export function persistBookingDisplayMeta(
  appointmentId: string,
  meta: { date?: string; time?: string; doctorName?: string },
): void {
  if (!appointmentId) return;
  try {
    sessionStorage.setItem(BOOKING_META_PREFIX + appointmentId, JSON.stringify(meta));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadBookingDisplayMeta(appointmentId: string): {
  date?: string;
  time?: string;
  doctorName?: string;
} | null {
  if (!appointmentId) return null;
  try {
    const raw = sessionStorage.getItem(BOOKING_META_PREFIX + appointmentId);
    if (!raw) return null;
    return JSON.parse(raw) as { date?: string; time?: string; doctorName?: string };
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickStr(obj: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function doctorNameFromUnknown(doc: unknown): string | undefined {
  const o = asRecord(doc);
  if (!o) return undefined;
  const single =
    pickStr(o, ["name", "doctorName", "fullName"]) ||
    pickStr(o, ["displayName"]);
  if (single) return single;
  const first = pickStr(o, ["firstName"]);
  const last = pickStr(o, ["lastName"]);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || undefined;
}

function parseDisplayFromDateTime(iso: string): { date: string; time: string } | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, time: `${hh}:${mm}` };
}

/** Pull doctor / date / time from varied status API shapes. */
export function extractAppointmentStatusDisplay(raw: unknown): {
  doctorName?: string;
  date?: string;
  time?: string;
} {
  const root = asRecord(raw) ?? {};
  const data = asRecord(root.data) ?? root;
  const appointment =
    asRecord(data.appointment) ?? asRecord(data.booking) ?? asRecord(root.appointment) ?? data;

  let doctorName =
    pickStr(appointment, ["doctorName", "doctor_name"]) ||
    doctorNameFromUnknown(appointment.doctor) ||
    doctorNameFromUnknown(data.doctor) ||
    doctorNameFromUnknown(root.doctor);

  let date = pickStr(appointment, ["date", "appointmentDate", "scheduledDate", "day"]);
  let time = pickStr(appointment, ["time", "startTime", "appointmentTime", "slotTime"]);

  const isoLike =
    pickStr(appointment, ["dateTime", "scheduledAt", "appointmentDateTime", "startDateTime"]) ||
    pickStr(data, ["scheduledAt", "dateTime"]) ||
    pickStr(root, ["scheduledAt"]);

  if (isoLike) {
    const parsed = parseDisplayFromDateTime(isoLike);
    if (parsed) {
      date = date || parsed.date;
      time = time || parsed.time;
    }
  }

  const slot = asRecord(appointment.slot);
  if (slot) {
    date = date || pickStr(slot, ["date", "appointmentDate", "day"]);
    time = time || pickStr(slot, ["time", "startTime"]);
    const sdt = pickStr(slot, ["dateTime"]);
    if (sdt) {
      const p = parseDisplayFromDateTime(sdt);
      if (p) {
        date = date || p.date;
        time = time || p.time;
      }
    }
  }

  return { doctorName, date, time };
}

/**
 * Final strings for chat / toast when an appointment is approved.
 * Prefer API fields when present; otherwise use values cached at booking time.
 */
export function resolveApprovedAppointmentDisplay(
  appointmentId: string,
  apiPayload: unknown,
): { doctorName: string; date: string; time: string } {
  const fromApi = extractAppointmentStatusDisplay(apiPayload);
  const cached = loadBookingDisplayMeta(appointmentId);
  const doctorName = (fromApi.doctorName || cached?.doctorName || "The doctor").trim();
  const date = (fromApi.date || cached?.date || "").trim();
  const time = (fromApi.time || cached?.time || "").trim();
  return {
    doctorName: doctorName || "The doctor",
    date: date || "your chosen date",
    time: time || "your chosen time",
  };
}

/** Extract appointment id from POST /appointments response (varied backends). */
export function extractAppointmentIdFromCreateResponse(res: unknown): string | undefined {
  const r = asRecord(res) ?? {};
  const data = asRecord(r.data) ?? r;
  const id =
    pickStr(r, ["appointmentId"]) ||
    pickStr(data, ["appointmentId", "_id", "id"]) ||
    (typeof data._id === "string" ? data._id : undefined) ||
    (typeof r._id === "string" ? r._id : undefined);
  return id?.trim() || undefined;
}

// Function to check appointment status from the API
export const checkAppointmentStatus = async (appointmentId: string): Promise<any> => {
  console.log(`Checking REAL status for appointment ${appointmentId}...`);
  try {
    const url = `${API_BASE_URL}/appointments/${appointmentId}/status`;
    console.log(`Calling API URL: ${url}`);
    
    const response = await fetch(url, {
      headers: createAuthHeaders()
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error ${response.status}: ${response.statusText}`, errorBody);
      throw new Error(`Failed to check appointment status. Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Status check response:", data);
    return data; // Return the actual status from API
  } catch (error) {
    console.error("Error in checkAppointmentStatus:", error);
    throw error;
  }
}; 