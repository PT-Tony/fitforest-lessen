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
          <h1 style={styles.title}>FitForest Lessen</h1>

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
    background: "#111827",
    color: "white",
    fontFamily: "Arial, sans-serif",
    padding: "20px",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    margin: "80px auto",
    background: "#1f2937",
    padding: "28px",
    borderRadius: "16px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
  },
  appShell: {
    width: "100%",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    background: "#1f2937",
    padding: "20px",
    borderRadius: "16px",
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    fontSize: "36px",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: "16px",
  },
  lessonTitle: {
    fontSize: "28px",
    margin: "0 0 8px",
  },
  subTitle: {
    marginTop: "24px",
    marginBottom: "8px",
  },
  tabs: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
    marginBottom: "20px",
  },
  tab: {
    flex: 1,
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #374151",
    background: "#111827",
    color: "white",
    cursor: "pointer",
  },
  activeTab: {
    flex: 1,
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #22c55e",
    background: "#22c55e",
    color: "#111827",
    fontWeight: "bold",
    cursor: "pointer",
  },
  label: {
    display: "block",
    marginTop: "12px",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #374151",
    background: "#111827",
    color: "white",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "100px",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #374151",
    background: "#111827",
    color: "white",
    boxSizing: "border-box",
    resize: "vertical",
  },
  button: {
    width: "100%",
    marginTop: "20px",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    background: "#22c55e",
    color: "#111827",
    fontWeight: "bold",
    cursor: "pointer",
  },
  logoutButton: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#374151",
    color: "white",
    cursor: "pointer",
  },
  dangerButton: {
    width: "100%",
    marginTop: "20px",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    background: "#f97316",
    color: "#111827",
    fontWeight: "bold",
    cursor: "pointer",
  },
  deleteButton: {
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ef4444",
    background: "transparent",
    color: "#fecaca",
    fontWeight: "bold",
    cursor: "pointer",
  },
  message: {
    background: "#374151",
    padding: "12px",
    borderRadius: "8px",
    color: "#d1d5db",
  },
  smallText: {
    color: "#d1d5db",
    margin: "4px 0",
  },
  adminBox: {
    background: "#1f2937",
    padding: "20px",
    borderRadius: "16px",
    marginBottom: "20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1.3fr",
    gap: "20px",
  },
  panel: {
    background: "#1f2937",
    padding: "20px",
    borderRadius: "16px",
  },
  lessonCard: {
    width: "100%",
    display: "grid",
    gap: "6px",
    textAlign: "left",
    padding: "14px",
    marginBottom: "10px",
    borderRadius: "12px",
    border: "1px solid #374151",
    background: "#111827",
    color: "white",
    cursor: "pointer",
  },
  activeLessonCard: {
    width: "100%",
    display: "grid",
    gap: "6px",
    textAlign: "left",
    padding: "14px",
    marginBottom: "10px",
    borderRadius: "12px",
    border: "1px solid #22c55e",
    background: "#064e3b",
    color: "white",
    cursor: "pointer",
  },
  description: {
    background: "#111827",
    padding: "14px",
    borderRadius: "12px",
    lineHeight: 1.5,
  },
  list: {
    background: "#111827",
    padding: "14px 14px 14px 32px",
    borderRadius: "12px",
  },
};

export default App;