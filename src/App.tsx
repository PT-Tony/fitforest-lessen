import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "./lib/supabase";
import type { User } from "@supabase/supabase-js";

type Profile = {
  id: string;
  username: string;
  role: "customer" | "admin";
};

type Booking = {
  id: string;
  user_id: string;
  profiles: { username: string } | { username: string }[] | null;
};

type Lesson = {
  id: string;
  title: string;
  description: string;
  lesson_date: string;
  lesson_time: string;
  bookings: Booking[];
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const [message, setMessage] = useState("Laden...");

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setMessage("");
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadAppData(user);
    } else {
      setProfile(null);
      setLessons([]);
    }
  }, [user]);

  async function loadAppData(currentUser: User) {
    setMessage("Lessen laden...");

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, role")
      .eq("id", currentUser.id)
      .single();

    if (profileError) {
      setMessage("Profiel fout: " + profileError.message);
      return;
    }

    setProfile(profileData as Profile);

    const today = new Date().toISOString().slice(0, 10);

    const { data: lessonsData, error: lessonsError } = await supabase
      .from("lessons")
      .select(`
        id,
        title,
        description,
        lesson_date,
        lesson_time,
        bookings (
          id,
          user_id,
          profiles (
            username
          )
        )
      `)
      .gte("lesson_date", today)
      .order("lesson_date", { ascending: true })
      .order("lesson_time", { ascending: true });

    if (lessonsError) {
      setMessage("Lessen fout: " + lessonsError.message);
      return;
    }

    setLessons((lessonsData as Lesson[]) ?? []);
    setMessage("");
  }

  async function register() {
    setMessage("");

    if (!email || !password || !username) {
      setMessage("Vul e-mail, wachtwoord en username in.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data.user) {
      setMessage("Account is aangemaakt. Check eventueel je e-mail.");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      username,
      role: "customer",
    });

    if (profileError) {
      setMessage("Account gemaakt, maar profiel fout: " + profileError.message);
      return;
    }

    setMessage("Account aangemaakt. Je bent nu ingelogd.");
  }

  async function login() {
    setMessage("");

    if (!email || !password) {
      setMessage("Vul e-mail en wachtwoord in.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Je bent ingelogd.");
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setLessons([]);
    setSelectedLessonId(null);
    setMessage("Je bent uitgelogd.");
  }

  async function createLesson() {
    if (!user || !profile || profile.role !== "admin") {
      setMessage("Alleen admin kan lessen toevoegen.");
      return;
    }

    if (!newTitle || !newDescription || !newDate || !newTime) {
      setMessage("Vul titel, beschrijving, datum en tijd in.");
      return;
    }

    const { error } = await supabase.from("lessons").insert({
      title: newTitle,
      description: newDescription,
      lesson_date: newDate,
      lesson_time: newTime,
      created_by: user.id,
    });

    if (error) {
      setMessage("Les toevoegen fout: " + error.message);
      return;
    }

    setNewTitle("");
    setNewDescription("");
    setNewDate("");
    setNewTime("");
    setMessage("Les toegevoegd.");

    await loadAppData(user);
  }

  async function deleteLesson(lessonId: string) {
    if (!user || !profile || profile.role !== "admin") {
      setMessage("Alleen admin kan lessen verwijderen.");
      return;
    }

    const confirmed = window.confirm("Weet je zeker dat je deze les wilt verwijderen?");

    if (!confirmed) {
      return;
    }

    const { error } = await supabase.from("lessons").delete().eq("id", lessonId);

    if (error) {
      setMessage("Les verwijderen fout: " + error.message);
      return;
    }

    setSelectedLessonId(null);
    setMessage("Les verwijderd.");

    await loadAppData(user);
  }

  async function bookLesson(lessonId: string) {
    if (!user) return;

    const { error } = await supabase.from("bookings").insert({
      lesson_id: lessonId,
      user_id: user.id,
    });

    if (error) {
      setMessage("Aanmelden fout: " + error.message);
      return;
    }

    setMessage("Je bent aangemeld.");
    await loadAppData(user);
  }

  async function cancelBooking(lesson: Lesson) {
    if (!user) return;

    const ownBooking = lesson.bookings.find((booking) => booking.user_id === user.id);

    if (!ownBooking) {
      setMessage("Je bent niet aangemeld voor deze les.");
      return;
    }

    const { error } = await supabase.from("bookings").delete().eq("id", ownBooking.id);

    if (error) {
      setMessage("Afmelden fout: " + error.message);
      return;
    }

    setMessage("Je bent afgemeld.");
    await loadAppData(user);
  }

  function getBookingUsername(booking: Booking) {
    if (Array.isArray(booking.profiles)) {
      return booking.profiles[0]?.username ?? "Onbekend";
    }

    return booking.profiles?.username ?? "Onbekend";
  }

  function formatDate(date: string) {
    return new Date(date + "T00:00:00").toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  function formatTime(time: string) {
    return time.slice(0, 5);
  }

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const userIsBooked =
    selectedLesson?.bookings.some((booking) => booking.user_id === user?.id) ?? false;

  if (!user) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>PT uren Rooster</h1>

          <div style={styles.tabs}>
            <button
              style={mode === "login" ? styles.activeTab : styles.tab}
              onClick={() => setMode("login")}
            >
              Inloggen
            </button>

            <button
              style={mode === "register" ? styles.activeTab : styles.tab}
              onClick={() => setMode("register")}
            >
              Account maken
            </button>
          </div>

          <label style={styles.label}>E-mail</label>
          <input
            style={styles.input}
            type="email"
            placeholder="jouw@email.nl"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label style={styles.label}>Wachtwoord</label>
          <input
            style={styles.input}
            type="password"
            placeholder="Kies een wachtwoord"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {mode === "register" && (
            <>
              <label style={styles.label}>Username</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Bijvoorbeeld Tony"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </>
          )}

          {mode === "login" ? (
            <button style={styles.button} onClick={login}>
              Inloggen
            </button>
          ) : (
            <button style={styles.button} onClick={register}>
              Account maken
            </button>
          )}

          {message && <p style={styles.message}>{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.appShell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>FitForest Lessen</h1>
            <p style={styles.smallText}>
              Ingelogd als {profile?.username ?? user.email}
              {profile?.role === "admin" ? " · Admin" : ""}
            </p>
          </div>

          <button style={styles.logoutButton} onClick={logout}>
            Uitloggen
          </button>
        </header>

        {message && <p style={styles.message}>{message}</p>}

        {profile?.role === "admin" && (
          <section style={styles.adminBox}>
            <h2 style={styles.sectionTitle}>Nieuwe les toevoegen</h2>

            <label style={styles.label}>Titel</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Bijvoorbeeld Personal training les"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
            />

            <label style={styles.label}>Datum</label>
            <input
              style={styles.input}
              type="date"
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
            />

            <label style={styles.label}>Tijd</label>
            <input
              style={styles.input}
              type="time"
              value={newTime}
              onChange={(event) => setNewTime(event.target.value)}
            />

            <label style={styles.label}>Beschrijving</label>
            <textarea
              style={styles.textarea}
              placeholder="Korte beschrijving van de les"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
            />

            <button style={styles.button} onClick={createLesson}>
              Les toevoegen
            </button>
          </section>
        )}

        <section style={styles.grid}>
          <div style={styles.panel}>
            <h2 style={styles.sectionTitle}>Aankomende lessen</h2>

            {lessons.length === 0 && <p style={styles.smallText}>Er staan nog geen lessen gepland.</p>}

            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                style={
                  selectedLessonId === lesson.id
                    ? styles.activeLessonCard
                    : styles.lessonCard
                }
                onClick={() => setSelectedLessonId(lesson.id)}
              >
                <strong>{lesson.title}</strong>
                <span>{formatDate(lesson.lesson_date)}</span>
                <span>{formatTime(lesson.lesson_time)} uur</span>
                <span>{lesson.bookings.length} aangemeld</span>
              </button>
            ))}
          </div>

          <div style={styles.panel}>
            <h2 style={styles.sectionTitle}>Lesinformatie</h2>

            {!selectedLesson && (
              <p style={styles.smallText}>Klik links op een les om de informatie te bekijken.</p>
            )}

            {selectedLesson && (
              <>
                <h3 style={styles.lessonTitle}>{selectedLesson.title}</h3>

                <p style={styles.smallText}>
                  {formatDate(selectedLesson.lesson_date)} om{" "}
                  {formatTime(selectedLesson.lesson_time)} uur
                </p>

                <p style={styles.description}>{selectedLesson.description}</p>

                <h3 style={styles.subTitle}>Aangemeld</h3>

                {selectedLesson.bookings.length === 0 ? (
                  <p style={styles.smallText}>Nog niemand aangemeld.</p>
                ) : (
                  <ul style={styles.list}>
                    {selectedLesson.bookings.map((booking) => (
                      <li key={booking.id}>{getBookingUsername(booking)}</li>
                    ))}
                  </ul>
                )}

                {!userIsBooked ? (
                  <button style={styles.button} onClick={() => bookLesson(selectedLesson.id)}>
                    Aanmelden
                  </button>
                ) : (
                  <button style={styles.dangerButton} onClick={() => cancelBooking(selectedLesson)}>
                    Afmelden
                  </button>
                )}

                {profile?.role === "admin" && (
                  <button
                    style={styles.deleteButton}
                    onClick={() => deleteLesson(selectedLesson.id)}
                  >
                    Les verwijderen
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(34,197,94,0.18), transparent 32%), linear-gradient(135deg, #07111f 0%, #111827 45%, #0b1220 100%)",
    color: "#f9fafb",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "24px",
    boxSizing: "border-box",
  },

  card: {
    width: "100%",
    maxWidth: "430px",
    margin: "90px auto",
    background: "rgba(15, 23, 42, 0.88)",
    padding: "32px",
    borderRadius: "24px",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    border: "1px solid rgba(148,163,184,0.18)",
    backdropFilter: "blur(14px)",
  },

  appShell: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "center",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))",
    padding: "24px",
    borderRadius: "26px",
    marginBottom: "22px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.32)",
    border: "1px solid rgba(148,163,184,0.16)",
  },

  title: {
    margin: 0,
    fontSize: "clamp(30px, 5vw, 48px)",
    lineHeight: 1,
    letterSpacing: "-1.4px",
    fontWeight: 900,
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "24px",
    letterSpacing: "-0.5px",
  },

  lessonTitle: {
    fontSize: "32px",
    margin: "0 0 10px",
    letterSpacing: "-0.7px",
  },

  subTitle: {
    marginTop: "26px",
    marginBottom: "10px",
    fontSize: "20px",
  },

  tabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginTop: "24px",
    marginBottom: "22px",
    padding: "6px",
    borderRadius: "14px",
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(148,163,184,0.12)",
  },

  tab: {
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    background: "transparent",
    color: "#cbd5e1",
    cursor: "pointer",
    fontWeight: 700,
  },

  activeTab: {
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "#052e16",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(34,197,94,0.26)",
  },

  label: {
    display: "block",
    marginTop: "14px",
    marginBottom: "7px",
    color: "#e5e7eb",
    fontSize: "14px",
    fontWeight: 800,
  },

  input: {
    width: "100%",
    padding: "14px 15px",
    borderRadius: "14px",
    border: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(2,6,23,0.58)",
    color: "#f8fafc",
    boxSizing: "border-box",
    outline: "none",
    fontSize: "15px",
  },

  textarea: {
    width: "100%",
    minHeight: "115px",
    padding: "14px 15px",
    borderRadius: "14px",
    border: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(2,6,23,0.58)",
    color: "#f8fafc",
    boxSizing: "border-box",
    resize: "vertical",
    outline: "none",
    fontSize: "15px",
    lineHeight: 1.5,
  },

  button: {
    width: "100%",
    marginTop: "22px",
    padding: "14px 18px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "#052e16",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 16px 32px rgba(34,197,94,0.28)",
    fontSize: "15px",
  },

  logoutButton: {
    padding: "12px 18px",
    borderRadius: "14px",
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.85)",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: 800,
  },

  dangerButton: {
    width: "100%",
    marginTop: "22px",
    padding: "14px 18px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(135deg, #fb923c, #f97316)",
    color: "#431407",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 16px 32px rgba(249,115,22,0.22)",
    fontSize: "15px",
  },

  deleteButton: {
    width: "100%",
    marginTop: "12px",
    padding: "13px 18px",
    borderRadius: "14px",
    border: "1px solid rgba(248,113,113,0.45)",
    background: "rgba(127,29,29,0.16)",
    color: "#fecaca",
    fontWeight: 900,
    cursor: "pointer",
  },

  message: {
    background: "rgba(15,23,42,0.88)",
    padding: "13px 15px",
    borderRadius: "14px",
    color: "#d1d5db",
    border: "1px solid rgba(148,163,184,0.16)",
    marginBottom: "18px",
  },

  smallText: {
    color: "#cbd5e1",
    margin: "6px 0",
    fontSize: "15px",
  },

  adminBox: {
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.88))",
    padding: "24px",
    borderRadius: "26px",
    marginBottom: "22px",
    border: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.26)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "22px",
    alignItems: "start",
  },

  panel: {
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.86))",
    padding: "24px",
    borderRadius: "26px",
    border: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.26)",
  },

  lessonCard: {
    width: "100%",
    display: "grid",
    gap: "8px",
    textAlign: "left",
    padding: "18px",
    marginBottom: "12px",
    borderRadius: "18px",
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(2,6,23,0.52)",
    color: "#f8fafc",
    cursor: "pointer",
    transition: "0.2s ease",
  },

  activeLessonCard: {
    width: "100%",
    display: "grid",
    gap: "8px",
    textAlign: "left",
    padding: "18px",
    marginBottom: "12px",
    borderRadius: "18px",
    border: "1px solid rgba(34,197,94,0.7)",
    background:
      "linear-gradient(135deg, rgba(6,78,59,0.95), rgba(20,83,45,0.78))",
    color: "#f8fafc",
    cursor: "pointer",
    boxShadow: "0 16px 34px rgba(34,197,94,0.15)",
  },

  description: {
    background: "rgba(2,6,23,0.5)",
    padding: "18px",
    borderRadius: "18px",
    lineHeight: 1.65,
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#e5e7eb",
  },

  list: {
    background: "rgba(2,6,23,0.5)",
    padding: "16px 16px 16px 36px",
    borderRadius: "18px",
    border: "1px solid rgba(148,163,184,0.12)",
    lineHeight: 1.8,
  },
};

export default App;