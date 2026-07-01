import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import type { User } from "@supabase/supabase-js";
import "./App.css";

type Profile = {
  id: string;
  username: string;
  role: "customer" | "admin";
  credits: number;
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

  const [creditEmail, setCreditEmail] = useState("");
  const [creditAmount, setCreditAmount] = useState("10");

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
      setSelectedLessonId(null);
    }
  }, [user]);

  async function loadAppData(currentUser: User) {
    setMessage("Lessen laden...");

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, role, credits")
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

    const loadedLessons = (lessonsData as Lesson[]) ?? [];
    setLessons(loadedLessons);

    setSelectedLessonId((current) => {
      if (current && loadedLessons.some((lesson) => lesson.id === current)) {
        return current;
      }

      return loadedLessons[0]?.id ?? null;
    });

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
      credits: 0,
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

  async function addCreditsToUser() {
    if (!user || !profile || profile.role !== "admin") {
      setMessage("Alleen admin kan credits toevoegen.");
      return;
    }

    const amount = Number(creditAmount);

    if (!creditEmail || !Number.isInteger(amount) || amount <= 0) {
      setMessage("Vul een geldig e-mailadres en aantal credits in.");
      return;
    }

    const { error } = await supabase.rpc("admin_add_credits_by_email", {
      p_email: creditEmail.trim(),
      p_amount: amount,
    });

    if (error) {
      setMessage("Credits toevoegen fout: " + error.message);
      return;
    }

    setMessage(`${amount} credits toegevoegd aan ${creditEmail}.`);
    setCreditEmail("");
    setCreditAmount("10");

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

    const { error } = await supabase.rpc("book_lesson_with_credit", {
      p_lesson_id: lessonId,
    });

    if (error) {
      setMessage("Aanmelden fout: " + error.message);
      return;
    }

    setMessage("Je bent aangemeld. 1 credit gebruikt.");
    await loadAppData(user);
  }

  async function cancelBooking(lesson: Lesson) {
    if (!user) return;

    const ownBooking = lesson.bookings.find((booking) => booking.user_id === user.id);

    if (!ownBooking) {
      setMessage("Je bent niet aangemeld voor deze les.");
      return;
    }

    const { error } = await supabase.rpc("cancel_booking_with_refund", {
      p_lesson_id: lesson.id,
    });

    if (error) {
      setMessage("Afmelden fout: " + error.message);
      return;
    }

    setMessage("Je bent afgemeld. 1 credit teruggezet.");
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

  function formatShortDate(date: string) {
    return new Date(date + "T00:00:00").toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
    });
  }

  function formatTime(time: string) {
    return time.slice(0, 5);
  }

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const userIsBooked =
    selectedLesson?.bookings.some((booking) => booking.user_id === user?.id) ?? false;

  const userCredits = profile?.credits ?? 0;

  if (!user) {
    return (
      <main className="page auth-page">
        <section className="auth-card">
          <div className="brand-pill">PT Rooster</div>

          <h1 className="auth-title">Training boeken</h1>
          <p className="auth-subtitle">
            Log in en meld je gemakkelijk aan voor je volgende training.
          </p>

          <div className="tabs">
            <button
              className={mode === "login" ? "tab active-tab" : "tab"}
              onClick={() => setMode("login")}
            >
              Inloggen
            </button>

            <button
              className={mode === "register" ? "tab active-tab" : "tab"}
              onClick={() => setMode("register")}
            >
              Account maken
            </button>
          </div>

          <label className="label">E-mail</label>
          <input
            className="input"
            type="email"
            placeholder="jouw@email.nl"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label className="label">Wachtwoord</label>
          <input
            className="input"
            type="password"
            placeholder="Je wachtwoord"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {mode === "register" && (
            <>
              <label className="label">Username</label>
              <input
                className="input"
                type="text"
                placeholder="Bijvoorbeeld Tony"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </>
          )}

          {mode === "login" ? (
            <button className="primary-button" onClick={login}>
              Inloggen
            </button>
          ) : (
            <button className="primary-button" onClick={register}>
              Account maken
            </button>
          )}

          {message && <p className="message">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="app-shell">
        <header className="topbar">
          <div>
            <div className="brand-pill">PT Rooster</div>
            <h1 className="page-title">Lessenagenda</h1>
            <p className="muted">
              Ingelogd als <strong>{profile?.username ?? user.email}</strong>
              {profile?.role === "admin" ? " · Admin" : ""}
            </p>
          </div>

          <button className="secondary-button" onClick={logout}>
            Uitloggen
          </button>
        </header>

        {message && <p className="message">{message}</p>}

        <section className="stats-grid">
          <article className="stat-card">
            <span>Aankomende lessen</span>
            <strong>{lessons.length}</strong>
          </article>

          <article className="stat-card">
            <span>Jouw aanmeldingen</span>
            <strong>
              {lessons.filter((lesson) =>
                lesson.bookings.some((booking) => booking.user_id === user.id)
              ).length}
            </strong>
          </article>

          <article className="stat-card">
            <span>Credits</span>
            <strong>{userCredits}</strong>
          </article>

          <article className="stat-card">
            <span>Status</span>
            <strong>{profile?.role === "admin" ? "Admin" : "Klant"}</strong>
          </article>
        </section>

        {profile?.role === "admin" && (
          <>
            <section className="admin-box">
              <div className="section-heading">
                <div>
                  <h2>Nieuwe les toevoegen</h2>
                  <p>Maak een training aan die klanten direct kunnen zien.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field form-wide">
                  <label className="label">Titel</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Bijvoorbeeld Personal training"
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label className="label">Datum</label>
                  <input
                    className="input"
                    type="date"
                    value={newDate}
                    onChange={(event) => setNewDate(event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label className="label">Tijd</label>
                  <input
                    className="input"
                    type="time"
                    value={newTime}
                    onChange={(event) => setNewTime(event.target.value)}
                  />
                </div>

                <div className="form-field form-wide">
                  <label className="label">Beschrijving</label>
                  <textarea
                    className="textarea"
                    placeholder="Korte beschrijving van de les"
                    value={newDescription}
                    onChange={(event) => setNewDescription(event.target.value)}
                  />
                </div>
              </div>

              <button className="primary-button" onClick={createLesson}>
                Les toevoegen
              </button>
            </section>

            <section className="admin-box">
              <div className="section-heading">
                <div>
                  <h2>Credits toevoegen</h2>
                  <p>Voeg handmatig credits toe nadat een klant heeft betaald.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label className="label">User e-mail</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="klant@email.nl"
                    value={creditEmail}
                    onChange={(event) => setCreditEmail(event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label className="label">Aantal credits</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    value={creditAmount}
                    onChange={(event) => setCreditAmount(event.target.value)}
                  />
                </div>
              </div>

              <button className="primary-button" onClick={addCreditsToUser}>
                Add {creditAmount || "x"} credits to {creditEmail || "x user (email)"}
              </button>
            </section>
          </>
        )}

        <section className="content-grid">
          <section className="panel lessons-panel">
            <div className="section-heading">
              <div>
                <h2>Aankomende lessen</h2>
                <p>Kies een les om details te bekijken.</p>
              </div>
            </div>

            {lessons.length === 0 && (
              <div className="empty-state">
                <strong>Geen lessen gepland</strong>
                <span>Er staan op dit moment nog geen trainingen online.</span>
              </div>
            )}

            <div className="lesson-list">
              {lessons.map((lesson) => {
                const isActive = selectedLessonId === lesson.id;
                const isBooked = lesson.bookings.some((booking) => booking.user_id === user.id);

                return (
                  <button
                    key={lesson.id}
                    className={isActive ? "lesson-card active-lesson" : "lesson-card"}
                    onClick={() => setSelectedLessonId(lesson.id)}
                  >
                    <div className="lesson-date-badge">
                      <span>{formatShortDate(lesson.lesson_date)}</span>
                      <strong>{formatTime(lesson.lesson_time)}</strong>
                    </div>

                    <div className="lesson-card-content">
                      <strong>{lesson.title}</strong>
                      <span>{lesson.bookings.length} aangemeld</span>
                    </div>

                    {isBooked && <span className="booked-badge">Aangemeld</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel details-panel">
            <div className="section-heading">
              <div>
                <h2>Lesinformatie</h2>
                <p>Bekijk de training en meld je aan of af.</p>
              </div>
            </div>

            {!selectedLesson && (
              <div className="empty-state">
                <strong>Selecteer een les</strong>
                <span>Klik op een les om de informatie te bekijken.</span>
              </div>
            )}

            {selectedLesson && (
              <div className="lesson-details">
                <div className="details-header">
                  <div>
                    <h3>{selectedLesson.title}</h3>
                    <p>
                      {formatDate(selectedLesson.lesson_date)} om{" "}
                      {formatTime(selectedLesson.lesson_time)} uur
                    </p>
                  </div>

                  {userIsBooked && <span className="booked-badge">Je bent aangemeld</span>}
                </div>

                <div className="description-box">{selectedLesson.description}</div>

                <div className="attendees-section">
                  <h3>Aangemeld</h3>

                  {selectedLesson.bookings.length === 0 ? (
                    <p className="muted">Nog niemand aangemeld.</p>
                  ) : (
                    <div className="attendee-list">
                      {selectedLesson.bookings.map((booking) => (
                        <span key={booking.id} className="attendee-chip">
                          {getBookingUsername(booking)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {!userIsBooked ? (
                  <button
                    className={userCredits <= 0 ? "disabled-button" : "primary-button"}
                    disabled={userCredits <= 0}
                    onClick={() => bookLesson(selectedLesson.id)}
                  >
                    {userCredits <= 0 ? "Geen credits beschikbaar" : "Aanmelden - 1 credit"}
                  </button>
                ) : (
                  <button className="warning-button" onClick={() => cancelBooking(selectedLesson)}>
                    Afmelden + 1 credit terug
                  </button>
                )}

                {profile?.role === "admin" && (
                  <button
                    className="delete-button"
                    onClick={() => deleteLesson(selectedLesson.id)}
                  >
                    Les verwijderen
                  </button>
                )}
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;