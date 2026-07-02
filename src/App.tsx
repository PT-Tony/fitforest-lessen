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
  max_participants: number;
  bookings: Booking[];
};

type View = "lessons" | "credits" | "challenges" | "admin";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [activeView, setActiveView] = useState<View>("lessons");
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newMaxParticipants, setNewMaxParticipants] = useState("10");

  const [creditEmail, setCreditEmail] = useState("");
  const [creditAmount, setCreditAmount] = useState("10");

  const [message, setMessage] = useState("Laden...");

  useEffect(() => {
  let isMounted = true;

  async function loadUser() {
    const { data } = await supabase.auth.getUser();

    if (isMounted) {
      setUser(data.user);
      setMessage("");
    }
  }

  loadUser();

  const { data: authListener } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      }

      setUser(session?.user ?? null);
    }
  );

  return () => {
    isMounted = false;
    authListener.subscription.unsubscribe();
  };
}, []);

  useEffect(() => {
    if (user) {
      loadAppData(user);
    } else {
      setProfile(null);
      setLessons([]);
      setSelectedLessonId(null);
      setActiveView("lessons");
    }
  }, [user]);

  useEffect(() => {
    if (profile?.role !== "admin" && activeView === "admin") {
      setActiveView("lessons");
    }
  }, [profile, activeView]);

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
        max_participants,
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
    setActiveView("lessons");
    setMessage("Je bent uitgelogd.");
  }

async function sendPasswordResetEmail() {
  setMessage("");

  if (!email) {
    setMessage("Vul eerst je e-mailadres in.");
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });

  if (error) {
    setMessage(error.message);
    return;
  }

  setMessage("Check je mail om je wachtwoord opnieuw in te stellen.");
  setMode("login");
}

async function updatePassword() {
  setMessage("");

  if (newPassword.length < 6) {
    setMessage("Je nieuwe wachtwoord moet minimaal 6 tekens hebben.");
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    setMessage(error.message);
    return;
  }

  setNewPassword("");
  setMessage("Je wachtwoord is aangepast. Log opnieuw in met je nieuwe wachtwoord.");
  setMode("login");

  await supabase.auth.signOut();
  setUser(null);
  setProfile(null);
}


  async function createLesson() {
    if (!user || !profile || profile.role !== "admin") {
      setMessage("Alleen admin kan lessen toevoegen.");
      return;
    }

    const maxParticipants = Number(newMaxParticipants);

if (
  !newTitle ||
  !newDescription ||
  !newDate ||
  !newTime ||
  !Number.isInteger(maxParticipants) ||
  maxParticipants <= 0
) {
  setMessage("Vul titel, beschrijving, datum, tijd en max deelnemers in.");
  return;
}

    const { error } = await supabase.from("lessons").insert({
  title: newTitle,
  description: newDescription,
  lesson_date: newDate,
  lesson_time: newTime,
  max_participants: maxParticipants,
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
    setNewMaxParticipants("10");
    setMessage("Les toegevoegd.");

    await loadAppData(user);
    setActiveView("lessons");
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

function canCancelLesson(lesson: Lesson) {
  const lessonDateTime = new Date(`${lesson.lesson_date}T${lesson.lesson_time}`);
  const now = new Date();
  const oneHourBeforeLesson = new Date(lessonDateTime.getTime() - 1 * 60 * 60 * 1000);

  return now < oneHourBeforeLesson;
}

function getCancelDeadlineText(lesson: Lesson) {
  const lessonDateTime = new Date(`${lesson.lesson_date}T${lesson.lesson_time}`);
  const deadline = new Date(lessonDateTime.getTime() - 1 * 60 * 60 * 1000);

  return deadline.toLocaleString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
const userIsBooked =
  selectedLesson?.bookings.some((booking) => booking.user_id === user?.id) ?? false;
const selectedLessonIsFull = selectedLesson
  ? selectedLesson.bookings.length >= selectedLesson.max_participants
  : false;
const userCanCancelSelectedLesson = selectedLesson ? canCancelLesson(selectedLesson) : false;
const userCredits = profile?.credits ?? 0;
  
  if (!user || mode === "reset") {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="eyebrow">Training Rooster | Tony</div>

        {mode === "login" && (
          <>
            <h1>Inloggen</h1>
            <p className="auth-subtitle">
              Log in om lessen te bekijken en je aan te melden.
            </p>

            <input
              className="form-input"
              type="email"
              placeholder="E-mailadres"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <input
              className="form-input"
              type="password"
              placeholder="Wachtwoord"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button className="primary-btn" type="button" onClick={login}>
              Inloggen
            </button>

            <button
  className="secondary-btn"
  type="button"
  onClick={() => {
    setMessage("");
    setMode("register");
  }}
>
  Account maken
</button>

<button
  className="text-btn"
  type="button"
  onClick={() => {
    setMessage("");
    setMode("forgot");
  }}
>
  Wachtwoord vergeten?
</button>
          </>
        )}

        {mode === "register" && (
          <>
            <h1>Account maken</h1>
            <p className="auth-subtitle">
              Maak een account aan om lessen te boeken.
            </p>

            <input
              className="form-input"
              type="text"
              placeholder="Naam"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />

            <input
              className="form-input"
              type="email"
              placeholder="E-mailadres"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <input
              className="form-input"
              type="password"
              placeholder="Wachtwoord"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button className="primary-btn" type="button" onClick={register}>
              Account maken
            </button>

            <button
              className="secondary-btn"
              type="button"
              onClick={() => {
                setMessage("");
                setMode("login");
              }}
            >
              Terug naar inloggen
            </button>
          </>
        )}

        {mode === "forgot" && (
          <>
            <h1>Wachtwoord vergeten</h1>
            <p className="auth-subtitle">
              Vul je e-mailadres in. Je krijgt een link om je wachtwoord opnieuw
              in te stellen.
            </p>

            <input
              className="form-input"
              type="email"
              placeholder="E-mailadres"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <button
              className="primary-btn"
              type="button"
              onClick={sendPasswordResetEmail}
            >
              Resetlink sturen
            </button>

            <button
              className="secondary-btn"
              type="button"
              onClick={() => {
                setMessage("");
                setMode("login");
              }}
            >
              Terug naar inloggen
            </button>
          </>
        )}

        {mode === "reset" && (
          <>
            <h1>Nieuw wachtwoord</h1>
            <p className="auth-subtitle">
              Kies hieronder je nieuwe wachtwoord.
            </p>

            <input
              className="form-input"
              type="password"
              placeholder="Nieuw wachtwoord"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />

            <button className="primary-btn" type="button" onClick={updatePassword}>
              Wachtwoord opslaan
            </button>
          </>
        )}

        {message && <p className="notice">{message}</p>}
      </section>
    </main>
  );
}

  return (
    <main className="app-page">
      <section className="app-container">
        <header className="app-header">
          <div>
            <p className="eyebrow">Training Rooster | Tony</p>
            <h1>Rooster</h1>
            <p className="header-meta">
              {profile?.username ?? user.email}
              {profile?.role === "admin" ? " · Admin" : ""}
            </p>
          </div>

          <button className="logout-btn" onClick={logout}>
            Uitloggen
          </button>
        </header>

        <nav className="main-tabs">
          <button
            className={activeView === "lessons" ? "main-tab active" : "main-tab"}
            onClick={() => setActiveView("lessons")}
          >
            Lessen
          </button>

          <button
            className={activeView === "credits" ? "main-tab active" : "main-tab"}
            onClick={() => setActiveView("credits")}
          >
            Credits
          </button>

<button
  className={activeView === "challenges" ? "main-tab active" : "main-tab"}
  onClick={() => setActiveView("challenges")}
>
  Challenges
</button>

          {profile?.role === "admin" && (
            <button
              className={activeView === "admin" ? "main-tab active" : "main-tab"}
              onClick={() => setActiveView("admin")}
            >
              Admin
            </button>
          )}
        </nav>

        {message && <p className="notice">{message}</p>}

                {activeView === "lessons" && (
          <section className="view">
            <section className="lessons-layout">
              <div className="card">
                <div className="card-heading">
                  <h2>Aankomende lessen</h2>
                  <p>Kies een training en bekijk de details.</p>
                </div>

                {lessons.length === 0 && (
                  <div className="empty-box">
                    <strong>Geen lessen gepland</strong>
                    <span>Er staan op dit moment geen trainingen online.</span>
                  </div>
                )}

                <div className="lesson-list">
                  {lessons.map((lesson) => {
                    const isBooked = lesson.bookings.some(
                      (booking) => booking.user_id === user?.id
                    );

                    const isFull =
                      lesson.bookings.length >= lesson.max_participants;

                    return (
                      <button
                        className={`lesson-item ${
                          selectedLessonId === lesson.id ? "active" : ""
                        } ${isFull ? "full" : ""}`}
                        key={lesson.id}
                        onClick={() => setSelectedLessonId(lesson.id)}
                      >
                        <div className="date-box">
  <strong>{formatShortDate(lesson.lesson_date)}</strong>
</div>

                        <div className="lesson-info">
                          <strong>{lesson.title}</strong>
                          <span>
                            {formatTime(lesson.lesson_time)} uur ·{" "}
                            {lesson.bookings.length}/{lesson.max_participants} plekken bezet
                          </span>
                        </div>

                        {isBooked && <span className="status-pill">Aangemeld</span>}

                        {!isBooked && isFull && (
                          <span className="status-pill">Vol</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="card">
                {!selectedLesson && (
                  <div className="empty-box">
                    <strong>Selecteer een les</strong>
                    <span>Klik op een les om de informatie te bekijken.</span>
                  </div>
                )}

                {selectedLesson && (
                  <div className="lesson-detail">
                    <h3>{selectedLesson.title}</h3>

                    <p className="lesson-time">
                      {formatDate(selectedLesson.lesson_date)} om{" "}
                      {formatTime(selectedLesson.lesson_time)} uur
                    </p>

                    <p className="lesson-capacity">
                      {selectedLesson.bookings.length}/
                      {selectedLesson.max_participants} plekken bezet
                    </p>

                    <div className="description-card">
                      {selectedLesson.description}
                    </div>

                    <div className="attendees">
                      <h4>Aangemeld</h4>

                      {selectedLesson.bookings.length === 0 && (
                        <p className="muted-text">Nog niemand aangemeld.</p>
                      )}

                      <div className="attendee-list">
                        {selectedLesson.bookings.map((booking) => {
                          const profileData = Array.isArray(booking.profiles)
                            ? booking.profiles[0]
                            : booking.profiles;

                          return (
                            <span className="attendee" key={booking.id}>
                              {profileData?.username ?? "Onbekend"}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {!userIsBooked ? (
                      <button
                        className={
                          userCredits <= 0 || selectedLessonIsFull
                            ? "disabled-btn"
                            : "primary-btn"
                        }
                        disabled={userCredits <= 0 || selectedLessonIsFull}
                        onClick={() => bookLesson(selectedLesson.id)}
                      >
                        {selectedLessonIsFull
                          ? "Les zit vol"
                          : userCredits <= 0
                            ? "Geen credits beschikbaar"
                            : "Aanmelden -1 credit"}
                      </button>
                    ) : (
                      <>
                        <p className="cancel-deadline">
                          Afmelden kan tot{" "}
                          {getCancelDeadlineText(selectedLesson)}.
                        </p>

                        <button
                          className={
                            userCanCancelSelectedLesson
                              ? "warning-btn"
                              : "disabled-btn"
                          }
                          disabled={!userCanCancelSelectedLesson}
                          onClick={() => cancelBooking(selectedLesson)}
                        >
                          {userCanCancelSelectedLesson
                            ? "Afmelden +1 credit"
                            : "Afmelden gesloten"}
                        </button>
                      </>
                    )}

                    {profile?.role === "admin" && (
                      <button
                        className="danger-btn"
                        onClick={() => deleteLesson(selectedLesson.id)}
                      >
                        Les verwijderen
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </section>
        )}

        {activeView === "credits" && (
          <section className="view credits-view">
            <section className="credits-card">
              <p className="credits-label">Beschikbare credits</p>
              <strong className="credits-number">{userCredits}</strong>
              <p className="credits-subtitle">
                Gebruik je credits om lessen te boeken.
              </p>
            </section>

            <section className="credits-rules">
              <div className="credit-rule">
                <span>1 credit</span>
                <strong>1 training</strong>
              </div>

              <div className="credit-rule">
                <span>Aanmelden</span>
                <strong>-1 credit</strong>
              </div>

              <div className="credit-rule">
                <span>Afmelden</span>
                <strong>+1 credit</strong>
              </div>
            </section>

            <section className="credits-note">
  <strong>Credits op?</strong>
  <p>Neem contact op met Tony om nieuwe credits te kopen.</p>

<div className="discount-banner">
  Eerste aankoop: 25% korting!
</div>

  <div className="price-table">
    <div className="price-row">
      <span>1 credit</span>
      <strong>€8,50</strong>
      <em>€8,50 per training</em>
    </div>

    <div className="price-row">
      <span>5 credits</span>
      <strong>€35,00</strong>
      <em>€7,00 per training</em>
    </div>

    <div className="price-row featured">
      <span>10 credits</span>
      <strong>€60,00</strong>
      <em>Populair · €6,00 per training</em>
    </div>

    <div className="price-row best">
      <span>20 credits</span>
      <strong>€100,00</strong>
      <em>Beste deal · €5,00 per training</em>
    </div>
  </div>
</section>
          </section>
        )}

{activeView === "challenges" && (
  <section className="view challenges-view">
    <section className="challenges-hero">
      <p className="challenges-kicker">FitForest Challenges</p>
      <h2>Kies jouw traject</h2>
      <p>
        Challenges zijn aparte trajecten naast losse credits. Na aankoop zet Tony
        de bijbehorende credits handmatig op je account.
      </p>
    </section>

    <section className="challenge-grid">
      <article className="challenge-card">
        <div className="challenge-top">
          <span className="challenge-badge">Beginner friendly</span>
          <h3>Get Active Again Challenge</h3>
          <p>
            Voor mensen die opnieuw willen beginnen met sporten en rustig willen
            opbouwen naar meer ritme, conditie en zelfvertrouwen.
          </p>
        </div>

        <div className="challenge-info">
          <div>
            <span>Duur</span>
            <strong>8 weken</strong>
          </div>

          <div>
            <span>Inclusief</span>
            <strong>5 gratis credits</strong>
          </div>

          <div>
            <span>Training</span>
            <strong>1-2x per week</strong>
          </div>
        </div>

        <ul className="challenge-list">
          <li>Startmeting en doel bepalen</li>
          <li>Laagdrempelige groepslessen of 1 op 1 lessen</li>
          <li>Focus op conditie, bewegen en routine</li>
          <li>Wekelijkse stok achter de deur</li>
        </ul>

        <div className="challenge-price">
          <span>Introprijs</span>
          <strong>€70</strong>
        </div>

        <button className="primary-btn" type="button">
          Vraag Tony om informatie
        </button>
      </article>

      <article className="challenge-card featured-challenge">
        <div className="challenge-top">
          <span className="challenge-badge">Populair</span>
          <h3>10 Weken Body Transformation</h3>
          <p>
            Voor mensen die serieuzer aan hun lichaam willen werken met meer
            structuur, meer trainingen en duidelijke voortgang.
          </p>
        </div>

        <div className="challenge-info">
          <div>
            <span>Duur</span>
            <strong>10 weken</strong>
          </div>

          <div>
            <span>Inclusief</span>
            <strong>10 gratis credits</strong>
          </div>

          <div>
            <span>Training</span>
            <strong>2-4x per week</strong>
          </div>
        </div>

        <ul className="challenge-list">
          <li>Startmeting en eindmeting</li>
          <li>Voortgangsfoto&apos;s en metingen</li>
          <li>Focus op kracht, conditie en vetverlies</li>
          <li>Meer focus op je dieet</li>
        </ul>

        <div className="challenge-price">
          <span>Introprijs</span>
          <strong>€120</strong>
        </div>

        <button className="primary-btn" type="button">
          Vraag Tony om informatie
        </button>
      </article>
    </section>

    <section className="challenge-note">
      <strong>Hoe werkt het?</strong>
      <p>
        Je koopt een challenge bij Tony. Deze challenge word aan jouw account gekoppeld zodat we in 1x een hele hoop lessen kunnen inplannen daarnaast krijg je ook nog extra gratis credits om mee te doen met de reguliere groepslessen!
      </p>
    </section>
  </section>
)}

        {activeView === "admin" && profile?.role === "admin" && (
          <section className="view">
            <section className="admin-dashboard">
              <div className="admin-header-card">
                <div>
                  <p className="admin-kicker">Admin paneel</p>
                  <h2>Beheer je rooster</h2>
                  <p>
                    Voeg lessen toe en beheer credits van klanten vanuit één
                    overzicht.
                  </p>
                </div>
              </div>

              <div className="admin-tools-grid">
                <section className="card admin-tool-card">
                  <div className="admin-tool-header">
                    <div>
                      <h2>Nieuwe les toevoegen</h2>
                      <p>
                        Maak een training aan die klanten direct kunnen boeken.
                      </p>
                    </div>
                  </div>

                  <label className="form-label">Titel</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Bijvoorbeeld Boxen"
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                  />

                  <div className="form-grid">
                    <div>
                      <label className="form-label">Datum</label>
                      <input
                        className="form-input"
                        type="date"
                        value={newDate}
                        onChange={(event) => setNewDate(event.target.value)}
                      />
                    </div>

                    <div>
                      <label className="form-label">Tijd</label>
                      <input
                        className="form-input"
                        type="time"
                        value={newTime}
                        onChange={(event) => setNewTime(event.target.value)}
                      />
                    </div>
                  </div>

                  <label className="form-label">Max deelnemers</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    step="1"
                    value={newMaxParticipants}
                    onChange={(event) =>
                      setNewMaxParticipants(event.target.value)
                    }
                  />

                  <label className="form-label">Beschrijving</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Korte beschrijving van de les"
                    value={newDescription}
                    onChange={(event) => setNewDescription(event.target.value)}
                  />

                  <button className="primary-btn" onClick={createLesson}>
                    Les toevoegen
                  </button>
                </section>

                <section className="card admin-tool-card">
                  <div className="admin-tool-header">
                    <div>
                      <h2>Credits toevoegen</h2>
                      <p>Voeg credits toe nadat een klant heeft betaald.</p>
                    </div>
                  </div>

                  <label className="form-label">Klant e-mail</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="klant@email.nl"
                    value={creditEmail}
                    onChange={(event) => setCreditEmail(event.target.value)}
                  />

                  <label className="form-label">Aantal credits</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    step="1"
                    value={creditAmount}
                    onChange={(event) => setCreditAmount(event.target.value)}
                  />

                  <button className="primary-btn" onClick={addCreditsToUser}>
                    Credits toevoegen
                  </button>

                  <div className="admin-note">
                    <strong>Let op:</strong>
                    <span>
                      De klant moet eerst een account hebben voordat je credits
                      kunt toevoegen.
                    </span>
                  </div>
                </section>
              </div>
            </section>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;