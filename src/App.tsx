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
  end_time: string;
  trainer_name: string;
  max_participants: number;
  bookings: Booking[];
};

type View = "lessons" | "credits" | "challenges" | "customers" | "admin";
type CustomerOverview = {
  user_id: string;
  username: string;
  email: string;
  credits: number;
  booking_count: number;
  challenges: string[];
};

type UserChallenge = {
  id: string;
  challenge_type: "get_active_again" | "body_transformation";
  status: "active" | "completed" | "cancelled";
  started_at: string;
};

type ChallengeSession = {
  id: string;
  enrollment_id: string;
  user_id: string;
  title: string;
  description: string;
  session_date: string;
  start_time: string;
  end_time: string;
  trainer_name: string;
  status: "scheduled" | "completed" | "cancelled";
};

type ChallengeParticipant = {
  enrollment_id: string;
  user_id: string;
  username: string;
  email: string;
  challenge_type: "get_active_again" | "body_transformation";
  started_at: string;
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [customers, setCustomers] = useState<CustomerOverview[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
    "login",
  );
  const [activeView, setActiveView] = useState<View>("lessons");
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);

  const [challengeWeekOffset, setChallengeWeekOffset] = useState(0);
  const [selectedChallengeDate, setSelectedChallengeDate] = useState(() =>
    toLocalDateKey(new Date()),
  );

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editTrainerName, setEditTrainerName] = useState("");
  const [editMaxParticipants, setEditMaxParticipants] = useState("10");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [adminChallengeSessions, setAdminChallengeSessions] = useState<
    ChallengeSession[]
  >([]);

  const [challengeSessions, setChallengeSessions] = useState<
    ChallengeSession[]
  >([]);
  const [challengeParticipants, setChallengeParticipants] = useState<
    ChallengeParticipant[]
  >([]);

  const [selectedChallengeParticipantId, setSelectedChallengeParticipantId] =
    useState("");

  const [challengeSessionTitle, setChallengeSessionTitle] =
    useState("Challenge training");

  const [challengeSessionDescription, setChallengeSessionDescription] =
    useState("");

  const [challengeSessionDate, setChallengeSessionDate] = useState("");
  const [challengeSessionStartTime, setChallengeSessionStartTime] =
    useState("");
  const [challengeSessionEndTime, setChallengeSessionEndTime] = useState("");
  const [challengeSessionTrainer, setChallengeSessionTrainer] =
    useState("Tony");

  const [showChallengePlanner, setShowChallengePlanner] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newTrainerName, setNewTrainerName] = useState("Tony");
  const [newMaxParticipants, setNewMaxParticipants] = useState("10");

  const [creditEmail, setCreditEmail] = useState("");
  const [creditAmount, setCreditAmount] = useState("10");

  const [message, setMessage] = useState("Laden...");

  function toLocalDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getMondayOfWeek(date: Date) {
    const result = new Date(date);
    result.setHours(12, 0, 0, 0);

    const day = result.getDay();
    const difference = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + difference);

    return result;
  }

  function getWeekDays(weekOffset: number) {
    const today = new Date();
    const monday = getMondayOfWeek(today);

    monday.setDate(monday.getDate() + weekOffset * 7);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);

      return date;
    });
  }

  function changeChallengeWeek(direction: number) {
    const newOffset = challengeWeekOffset + direction;
    const newWeekDays = getWeekDays(newOffset);

    setChallengeWeekOffset(newOffset);
    setSelectedChallengeDate(toLocalDateKey(newWeekDays[0]));
  }

  function startEditingLesson(lesson: Lesson) {
    setEditingLessonId(lesson.id);
    setEditTitle(lesson.title);
    setEditDescription(lesson.description);
    setEditDate(lesson.lesson_date);
    setEditStartTime(formatTime(lesson.lesson_time));
    setEditEndTime(formatTime(lesson.end_time));
    setEditTrainerName(lesson.trainer_name);
    setEditMaxParticipants(String(lesson.max_participants));
    setMessage("");
  }

  function cancelEditingLesson() {
    setEditingLessonId(null);
    setMessage("");
  }

  async function saveLessonChanges() {
    if (!editingLessonId || !user) {
      return;
    }

    const maxParticipants = Number(editMaxParticipants);

    if (
      !editTitle.trim() ||
      !editDescription.trim() ||
      !editDate ||
      !editStartTime ||
      !editEndTime ||
      !editTrainerName.trim() ||
      !Number.isInteger(maxParticipants) ||
      maxParticipants <= 0
    ) {
      setMessage("Vul alle lesgegevens correct in.");
      return;
    }

    if (editEndTime <= editStartTime) {
      setMessage("De eindtijd moet later zijn dan de starttijd.");
      return;
    }

    const currentLesson = lessons.find(
      (lesson) => lesson.id === editingLessonId,
    );

    if (currentLesson && maxParticipants < currentLesson.bookings.length) {
      setMessage(
        `Er zijn al ${currentLesson.bookings.length} deelnemers aangemeld. Het maximum kan niet lager zijn.`,
      );
      return;
    }

    const { error } = await supabase
      .from("lessons")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim(),
        lesson_date: editDate,
        lesson_time: editStartTime,
        end_time: editEndTime,
        trainer_name: editTrainerName.trim(),
        max_participants: maxParticipants,
      })
      .eq("id", editingLessonId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("De les is succesvol aangepast.");
    setEditingLessonId(null);
    await loadAppData(user);
  }

  async function loadChallengeParticipants() {
    if (profile?.role !== "admin") {
      return;
    }

    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("challenge_enrollments")
      .select(
        `
        id,
        user_id,
        challenge_type,
        started_at,
        status,
        profiles (
          username
        )
      `,
      )
      .eq("status", "active")
      .order("started_at", { ascending: false });

    if (enrollmentError) {
      setMessage(enrollmentError.message);
      return;
    }

    const participants = (enrollmentData ?? []).map((enrollment) => {
      const profileData = Array.isArray(enrollment.profiles)
        ? enrollment.profiles[0]
        : enrollment.profiles;

      return {
        enrollment_id: enrollment.id,
        user_id: enrollment.user_id,
        username: profileData?.username ?? "Onbekende klant",
        email: "",
        challenge_type: enrollment.challenge_type,
        started_at: enrollment.started_at,
      } as ChallengeParticipant;
    });

    setChallengeParticipants(participants);

    setSelectedChallengeParticipantId((current) => {
      if (
        current &&
        participants.some((item) => item.enrollment_id === current)
      ) {
        return current;
      }

      return participants[0]?.enrollment_id ?? "";
    });
  }

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
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedChallengeParticipantId) {
      loadAdminChallengeSessions(selectedChallengeParticipantId);
    } else {
      setAdminChallengeSessions([]);
    }
  }, [selectedChallengeParticipantId]);

  useEffect(() => {
    if (activeView === "challenges" && profile?.role === "admin") {
      loadChallengeParticipants();
    }
  }, [activeView, profile?.role]);

  useEffect(() => {
    if (user) {
      loadAppData(user);
    } else {
      setProfile(null);
      setLessons([]);
      setUserChallenges([]);
      setChallengeSessions([]);
      setChallengeParticipants([]);
      setAdminChallengeSessions([]);
      setSelectedChallengeParticipantId("");
      setSelectedLessonId(null);
      setActiveView("lessons");
    }
  }, [user]);

  useEffect(() => {
    const isAdminView = activeView === "admin" || activeView === "customers";

    if (profile?.role !== "admin" && isAdminView) {
      setActiveView("lessons");
    }
  }, [profile, activeView]);

  useEffect(() => {
    if (activeView === "customers" && profile?.role === "admin") {
      loadCustomerOverview();
    }
  }, [activeView, profile?.role]);

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

    const { data: challengeData, error: challengeError } = await supabase
      .from("challenge_enrollments")
      .select("id, challenge_type, status, started_at")
      .eq("user_id", currentUser.id)
      .eq("status", "active")
      .order("started_at", { ascending: false });

    const { data: challengeSessionData, error: challengeSessionError } =
      await supabase
        .from("challenge_sessions")
        .select(
          `
        id,
        enrollment_id,
        user_id,
        title,
        description,
        session_date,
        start_time,
        end_time,
        trainer_name,
        status
      `,
        )
        .eq("user_id", currentUser.id)
        .neq("status", "cancelled")
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });

    if (challengeSessionError) {
      setMessage(challengeSessionError.message);
    } else {
      setChallengeSessions((challengeSessionData ?? []) as ChallengeSession[]);
    }

    if (challengeError) {
      setMessage(challengeError.message);
    } else {
      setUserChallenges((challengeData ?? []) as UserChallenge[]);
    }

    setProfile(profileData as Profile);

    const today = new Date().toISOString().slice(0, 10);

    const { data: lessonsData, error: lessonsError } = await supabase
      .from("lessons")
      .select(
        `
        id,
title,
description,
lesson_date,
lesson_time,
end_time,
trainer_name,
max_participants,
bookings (
          id,
          user_id,
          profiles (
            username
          )
        )
      `,
      )
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

  async function loadAdminChallengeSessions(enrollmentId: string) {
    if (!enrollmentId) {
      setAdminChallengeSessions([]);
      return;
    }

    const { data, error } = await supabase
      .from("challenge_sessions")
      .select(
        `
        id,
        enrollment_id,
        user_id,
        title,
        description,
        session_date,
        start_time,
        end_time,
        trainer_name,
        status
      `,
      )
      .eq("enrollment_id", enrollmentId)
      .neq("status", "cancelled")
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setAdminChallengeSessions((data ?? []) as ChallengeSession[]);
  }

  async function createChallengeSession() {
    if (profile?.role !== "admin") {
      return;
    }

    const selectedParticipant = challengeParticipants.find(
      (participant) =>
        participant.enrollment_id === selectedChallengeParticipantId,
    );

    if (!selectedParticipant) {
      setMessage("Selecteer eerst een challenge-deelnemer.");
      return;
    }

    if (
      !challengeSessionTitle.trim() ||
      !challengeSessionDate ||
      !challengeSessionStartTime ||
      !challengeSessionEndTime ||
      !challengeSessionTrainer.trim()
    ) {
      setMessage("Vul titel, datum, tijden en trainer in.");
      return;
    }

    if (challengeSessionEndTime <= challengeSessionStartTime) {
      setMessage("De eindtijd moet later zijn dan de starttijd.");
      return;
    }

    const { error } = await supabase.from("challenge_sessions").insert({
      enrollment_id: selectedParticipant.enrollment_id,
      user_id: selectedParticipant.user_id,
      title: challengeSessionTitle.trim(),
      description: challengeSessionDescription.trim(),
      session_date: challengeSessionDate,
      start_time: challengeSessionStartTime,
      end_time: challengeSessionEndTime,
      trainer_name: challengeSessionTrainer.trim(),
      status: "scheduled",
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      `Challenge-afspraak ingepland voor ${selectedParticipant.username}.`,
    );

    setChallengeSessionTitle("Challenge training");
    setChallengeSessionDescription("");
    setChallengeSessionDate("");
    setChallengeSessionStartTime("");
    setChallengeSessionEndTime("");

    await loadAdminChallengeSessions(selectedParticipant.enrollment_id);
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

  async function deleteChallengeSession(sessionId: string) {
    const shouldDelete = window.confirm(
      "Weet je zeker dat je deze challenge-afspraak wilt verwijderen?",
    );

    if (!shouldDelete) {
      return;
    }

    const { error } = await supabase
      .from("challenge_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Challenge-afspraak verwijderd.");

    await loadAdminChallengeSessions(selectedChallengeParticipantId);
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
    setUserChallenges([]);
    setChallengeSessions([]);
    setChallengeParticipants([]);
    setAdminChallengeSessions([]);
    setSelectedChallengeParticipantId("");
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
    setMessage(
      "Je wachtwoord is aangepast. Log opnieuw in met je nieuwe wachtwoord.",
    );
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
      !newEndTime ||
      !newTrainerName.trim() ||
      !Number.isInteger(maxParticipants) ||
      maxParticipants <= 0
    ) {
      setMessage(
        "Vul titel, beschrijving, datum, starttijd, eindtijd, trainer en max deelnemers in.",
      );
      return;
    }

    if (newEndTime <= newTime) {
      setMessage("De eindtijd moet later zijn dan de starttijd.");
      return;
    }
    const { error } = await supabase.from("lessons").insert({
      title: newTitle,
      description: newDescription,
      lesson_date: newDate,
      lesson_time: newTime,
      end_time: newEndTime,
      trainer_name: newTrainerName.trim(),
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
    setNewEndTime("");
    setNewTrainerName("Tony");
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

    const confirmed = window.confirm(
      "Weet je zeker dat je deze les wilt verwijderen?",
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lessonId);

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

    const ownBooking = lesson.bookings.find(
      (booking) => booking.user_id === user.id,
    );

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
    const lessonDateTime = new Date(
      `${lesson.lesson_date}T${lesson.lesson_time}`,
    );
    const now = new Date();
    const oneHourBeforeLesson = new Date(
      lessonDateTime.getTime() - 1 * 60 * 60 * 1000,
    );

    return now < oneHourBeforeLesson;
  }

  function getCancelDeadlineText(lesson: Lesson) {
    const lessonDateTime = new Date(
      `${lesson.lesson_date}T${lesson.lesson_time}`,
    );
    const deadline = new Date(lessonDateTime.getTime() - 1 * 60 * 60 * 1000);

    return deadline.toLocaleString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function loadCustomerOverview() {
    if (profile?.role !== "admin") {
      return;
    }

    setLoadingCustomers(true);

    const { data, error } = await supabase.rpc("admin_get_customer_overview");

    setLoadingCustomers(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setCustomers((data ?? []) as CustomerOverview[]);
  }

  async function addCreditsFromOverview(customerEmail: string, amount: number) {
    setMessage("");

    const { error } = await supabase.rpc("admin_add_credits_by_email", {
      p_email: customerEmail,
      p_amount: amount,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${amount} credits toegevoegd.`);
    await loadCustomerOverview();

    if (user) {
      await loadAppData(user);
    }
  }

  async function assignChallenge(customerId: string, challengeType: string) {
    setMessage("");

    const { error } = await supabase.rpc("admin_assign_challenge", {
      p_user_id: customerId,
      p_challenge_type: challengeType,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Challenge aan klant toegewezen.");
    await loadCustomerOverview();
  }

  async function removeChallenge(customerId: string, challengeType: string) {
    setMessage("");

    const { error } = await supabase.rpc("admin_remove_challenge", {
      p_user_id: customerId,
      p_challenge_type: challengeType,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Challenge verwijderd.");
    await loadCustomerOverview();
  }

  function getChallengeLabel(challengeType: string) {
    if (challengeType === "get_active_again") {
      return "Get Active Again";
    }

    if (challengeType === "body_transformation") {
      return "10-Week Body Transformation";
    }

    return challengeType;
  }

  const selectedLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const userIsBooked =
    selectedLesson?.bookings.some((booking) => booking.user_id === user?.id) ??
    false;
  const selectedLessonIsFull = selectedLesson
    ? selectedLesson.bookings.length >= selectedLesson.max_participants
    : false;
  const userCanCancelSelectedLesson = selectedLesson
    ? canCancelLesson(selectedLesson)
    : false;
  const userCredits = profile?.credits ?? 0;
  const filteredCustomers = customers.filter((customer) => {
    const searchValue = customerSearch.toLowerCase().trim();

    if (!searchValue) {
      return true;
    }

    return (
      customer.username.toLowerCase().includes(searchValue) ||
      customer.email.toLowerCase().includes(searchValue)
    );
  });

  const challengeWeekDays = getWeekDays(challengeWeekOffset);

  const selectedChallengeDaySessions = challengeSessions.filter(
    (session) =>
      session.session_date === selectedChallengeDate &&
      session.status !== "cancelled",
  );

  const challengeWeekStart = challengeWeekDays[0];
  const challengeWeekEnd = challengeWeekDays[6];

  const challengeWeekLabel = `${challengeWeekStart.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  })} – ${challengeWeekEnd.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

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
                Vul je e-mailadres in. Je krijgt een link om je wachtwoord
                opnieuw in te stellen.
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

              <button
                className="primary-btn"
                type="button"
                onClick={updatePassword}
              >
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
            className={
              activeView === "lessons" ? "main-tab active" : "main-tab"
            }
            onClick={() => setActiveView("lessons")}
          >
            Lessen
          </button>

          <button
            className={
              activeView === "credits" ? "main-tab active" : "main-tab"
            }
            onClick={() => setActiveView("credits")}
          >
            Credits
          </button>

          <button
            className={
              activeView === "challenges" ? "main-tab active" : "main-tab"
            }
            onClick={() => setActiveView("challenges")}
          >
            Challenges
          </button>

          {profile?.role === "admin" && (
            <>
              <button
                className={
                  activeView === "customers" ? "main-tab active" : "main-tab"
                }
                onClick={() => setActiveView("customers")}
              >
                Klanten
              </button>

              <button
                className={
                  activeView === "admin" ? "main-tab active" : "main-tab"
                }
                onClick={() => setActiveView("admin")}
              >
                Admin
              </button>
            </>
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
                      (booking) => booking.user_id === user?.id,
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
                            {formatTime(lesson.lesson_time)} -{" "}
                            {formatTime(lesson.end_time)} uur ·{" "}
                            {lesson.bookings.length}/{lesson.max_participants}{" "}
                            plekken bezet
                          </span>
                        </div>

                        {isBooked && (
                          <span className="status-pill">Aangemeld</span>
                        )}

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
                      {formatDate(selectedLesson.lesson_date)} van{" "}
                      {formatTime(selectedLesson.lesson_time)} tot{" "}
                      {formatTime(selectedLesson.end_time)} uur
                    </p>

                    <p className="lesson-trainer">
                      Gegeven door {selectedLesson.trainer_name}
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
                      <>
                        {editingLessonId === selectedLesson.id ? (
                          <section className="edit-lesson-panel">
                            <div className="edit-lesson-heading">
                              <h4>Les bewerken</h4>
                              <p>
                                Pas hieronder de gegevens van deze training aan.
                              </p>
                            </div>

                            <label className="form-label">Titel</label>
                            <input
                              className="form-input"
                              type="text"
                              value={editTitle}
                              onChange={(event) =>
                                setEditTitle(event.target.value)
                              }
                            />

                            <div className="form-grid">
                              <div>
                                <label className="form-label">Datum</label>
                                <input
                                  className="form-input"
                                  type="date"
                                  value={editDate}
                                  onChange={(event) =>
                                    setEditDate(event.target.value)
                                  }
                                />
                              </div>

                              <div>
                                <label className="form-label">Trainer</label>
                                <input
                                  className="form-input"
                                  type="text"
                                  value={editTrainerName}
                                  onChange={(event) =>
                                    setEditTrainerName(event.target.value)
                                  }
                                />
                              </div>
                            </div>

                            <div className="form-grid">
                              <div>
                                <label className="form-label">Starttijd</label>
                                <input
                                  className="form-input"
                                  type="time"
                                  value={editStartTime}
                                  onChange={(event) =>
                                    setEditStartTime(event.target.value)
                                  }
                                />
                              </div>

                              <div>
                                <label className="form-label">Eindtijd</label>
                                <input
                                  className="form-input"
                                  type="time"
                                  value={editEndTime}
                                  onChange={(event) =>
                                    setEditEndTime(event.target.value)
                                  }
                                />
                              </div>
                            </div>

                            <label className="form-label">Max deelnemers</label>
                            <input
                              className="form-input"
                              type="number"
                              min={selectedLesson.bookings.length || 1}
                              step="1"
                              value={editMaxParticipants}
                              onChange={(event) =>
                                setEditMaxParticipants(event.target.value)
                              }
                            />

                            <label className="form-label">Beschrijving</label>
                            <textarea
                              className="form-textarea"
                              value={editDescription}
                              onChange={(event) =>
                                setEditDescription(event.target.value)
                              }
                            />

                            <div className="edit-lesson-actions">
                              <button
                                className="primary-btn"
                                type="button"
                                onClick={saveLessonChanges}
                              >
                                Wijzigingen opslaan
                              </button>

                              <button
                                className="secondary-btn"
                                type="button"
                                onClick={cancelEditingLesson}
                              >
                                Annuleren
                              </button>
                            </div>
                          </section>
                        ) : (
                          <div className="admin-lesson-actions">
                            <button
                              className="secondary-btn"
                              type="button"
                              onClick={() => startEditingLesson(selectedLesson)}
                            >
                              Les bewerken
                            </button>

                            <button
                              className="danger-btn"
                              type="button"
                              onClick={() => deleteLesson(selectedLesson.id)}
                            >
                              Les verwijderen
                            </button>
                          </div>
                        )}
                      </>
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

        {activeView === "challenges" && profile?.role === "admin" && (
          <section className="challenge-admin-panel">
            <div className="challenge-admin-header">
              <div>
                <p className="admin-kicker">Challenge beheer</p>
                <h2>Challenge deelnemers</h2>
                <p>
                  Plan privé challenge-afspraken in voor een specifieke
                  deelnemer.
                </p>
              </div>

              <button
                className="secondary-btn"
                type="button"
                onClick={() => setShowChallengePlanner(!showChallengePlanner)}
              >
                {showChallengePlanner
                  ? "Planner sluiten"
                  : "Afspraak inplannen"}
              </button>
            </div>

            <label className="form-label">Selecteer deelnemer</label>

            <select
              className="form-input"
              value={selectedChallengeParticipantId}
              onChange={(event) =>
                setSelectedChallengeParticipantId(event.target.value)
              }
            >
              <option value="">Kies een challenge-deelnemer</option>

              {challengeParticipants.map((participant) => (
                <option
                  key={participant.enrollment_id}
                  value={participant.enrollment_id}
                >
                  {participant.username} —{" "}
                  {getChallengeLabel(participant.challenge_type)}
                </option>
              ))}
            </select>

            {showChallengePlanner && selectedChallengeParticipantId && (
              <section className="challenge-planner-form">
                <label className="form-label">Titel</label>
                <input
                  className="form-input"
                  type="text"
                  value={challengeSessionTitle}
                  onChange={(event) =>
                    setChallengeSessionTitle(event.target.value)
                  }
                />

                <label className="form-label">Beschrijving</label>
                <textarea
                  className="form-textarea"
                  value={challengeSessionDescription}
                  onChange={(event) =>
                    setChallengeSessionDescription(event.target.value)
                  }
                />

                <label className="form-label">Datum</label>
                <input
                  className="form-input"
                  type="date"
                  value={challengeSessionDate}
                  onChange={(event) =>
                    setChallengeSessionDate(event.target.value)
                  }
                />

                <div className="form-grid">
                  <div>
                    <label className="form-label">Starttijd</label>
                    <input
                      className="form-input"
                      type="time"
                      value={challengeSessionStartTime}
                      onChange={(event) =>
                        setChallengeSessionStartTime(event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className="form-label">Eindtijd</label>
                    <input
                      className="form-input"
                      type="time"
                      value={challengeSessionEndTime}
                      onChange={(event) =>
                        setChallengeSessionEndTime(event.target.value)
                      }
                    />
                  </div>
                </div>

                <label className="form-label">Trainer</label>
                <input
                  className="form-input"
                  type="text"
                  value={challengeSessionTrainer}
                  onChange={(event) =>
                    setChallengeSessionTrainer(event.target.value)
                  }
                />

                <button
                  className="primary-btn"
                  type="button"
                  onClick={createChallengeSession}
                >
                  Afspraak inplannen
                </button>
              </section>
            )}

            {selectedChallengeParticipantId && (
              <section className="planned-challenge-sessions">
                <h3>Ingeplande afspraken</h3>

                {adminChallengeSessions.length === 0 ? (
                  <div className="empty-box">
                    <strong>Nog geen afspraken</strong>
                    <span>
                      Voor deze deelnemer staan nog geen challenge-afspraken
                      gepland.
                    </span>
                  </div>
                ) : (
                  adminChallengeSessions.map((session) => (
                    <article
                      className="planned-challenge-session"
                      key={session.id}
                    >
                      <div>
                        <span>
                          {new Date(
                            `${session.session_date}T12:00:00`,
                          ).toLocaleDateString("nl-NL", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </span>

                        <h4>{session.title}</h4>

                        <p>
                          {formatTime(session.start_time)} –{" "}
                          {formatTime(session.end_time)} ·{" "}
                          {session.trainer_name}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteChallengeSession(session.id)}
                      >
                        Verwijderen
                      </button>
                    </article>
                  ))
                )}
              </section>
            )}
          </section>
        )}

        {activeView === "challenges" && profile?.role !== "admin" && (
          <section className="view challenges-view">
            {userChallenges.length > 0 ? (
              <>
                <section className="challenges-hero active-challenge-hero">
                  <p className="challenges-kicker">Mijn challenge</p>
                  <h2>Jouw actieve traject</h2>
                  <p>
                    Hieronder vind je de challenge die momenteel aan jouw
                    account is gekoppeld.
                  </p>
                </section>

                <section className="active-challenges-list">
                  {userChallenges.map((challenge) => {
                    const isGetActiveAgain =
                      challenge.challenge_type === "get_active_again";

                    return (
                      <article
                        className="challenge-card active-user-challenge"
                        key={challenge.id}
                      >
                        <div className="challenge-top">
                          <span className="challenge-badge">Actief</span>

                          <h3>
                            {isGetActiveAgain
                              ? "Get Active Again Challenge"
                              : "10-Week Body Transformation"}
                          </h3>

                          <p>
                            {isGetActiveAgain
                              ? "Werk in 8 weken aan meer beweging, conditie, ritme en zelfvertrouwen."
                              : "Werk in 10 weken gestructureerd aan kracht, conditie en lichaamssamenstelling."}
                          </p>
                        </div>

                        <div className="challenge-info">
                          <div>
                            <span>Duur</span>
                            <strong>
                              {isGetActiveAgain ? "8 weken" : "10 weken"}
                            </strong>
                          </div>

                          <div>
                            <span>Status</span>
                            <strong>Actief</strong>
                          </div>

                          <div>
                            <span>Startdatum</span>
                            <strong>
                              {new Date(
                                `${challenge.started_at}T12:00:00`,
                              ).toLocaleDateString("nl-NL", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </strong>
                          </div>
                        </div>

                        <section className="challenge-calendar">
                          <div className="challenge-calendar-header">
                            <button
                              className="calendar-arrow-btn"
                              type="button"
                              aria-label="Vorige week"
                              onClick={() => changeChallengeWeek(-1)}
                            >
                              ‹
                            </button>

                            <div>
                              <span>Mijn weekplanning</span>
                              <strong>{challengeWeekLabel}</strong>
                            </div>

                            <button
                              className="calendar-arrow-btn"
                              type="button"
                              aria-label="Volgende week"
                              onClick={() => changeChallengeWeek(1)}
                            >
                              ›
                            </button>
                          </div>

                          <div className="challenge-calendar-days">
                            {challengeWeekDays.map((date) => {
                              const dateKey = toLocalDateKey(date);
                              const isSelected =
                                selectedChallengeDate === dateKey;
                              const isToday =
                                dateKey === toLocalDateKey(new Date());

                              const hasBooking = challengeSessions.some(
                                (session) =>
                                  session.session_date === dateKey &&
                                  session.status !== "cancelled",
                              );

                              return (
                                <button
                                  className={[
                                    "challenge-calendar-day",
                                    isSelected ? "selected" : "",
                                    isToday ? "today" : "",
                                    hasBooking ? "has-booking" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  key={dateKey}
                                  type="button"
                                  onClick={() =>
                                    setSelectedChallengeDate(dateKey)
                                  }
                                >
                                  <span>
                                    {date
                                      .toLocaleDateString("nl-NL", {
                                        weekday: "short",
                                      })
                                      .replace(".", "")}
                                  </span>

                                  <strong>{date.getDate()}</strong>

                                  <small>{hasBooking ? "●" : ""}</small>
                                </button>
                              );
                            })}
                          </div>

                          <div className="challenge-selected-day">
                            <div className="challenge-selected-day-heading">
                              <div>
                                <span>Geselecteerde dag</span>
                                <strong>
                                  {new Date(
                                    `${selectedChallengeDate}T12:00:00`,
                                  ).toLocaleDateString("nl-NL", {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long",
                                  })}
                                </strong>
                              </div>

                              {selectedChallengeDaySessions.length > 0 && (
                                <span className="day-training-count">
                                  {selectedChallengeDaySessions.length}{" "}
                                  {selectedChallengeDaySessions.length === 1
                                    ? "training"
                                    : "trainingen"}
                                </span>
                              )}
                            </div>

                            {selectedChallengeDaySessions.length === 0 ? (
                              <div className="challenge-rest-day">
                                <strong>Geen training gepland</strong>
                                <span>
                                  Er staat op deze dag geen challenge-afspraak
                                  gepland.
                                </span>
                              </div>
                            ) : (
                              <div className="challenge-day-lessons">
                                {selectedChallengeDaySessions.map((session) => (
                                  <article
                                    className="challenge-calendar-lesson"
                                    key={session.id}
                                  >
                                    <div>
                                      <span className="calendar-lesson-time">
                                        {formatTime(session.start_time)} –{" "}
                                        {formatTime(session.end_time)}
                                      </span>

                                      <h4>{session.title}</h4>

                                      <p>Trainer: {session.trainer_name}</p>

                                      {session.description && (
                                        <p>{session.description}</p>
                                      )}
                                    </div>

                                    <span className="calendar-booked-pill">
                                      Ingepland
                                    </span>
                                  </article>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            className="secondary-btn calendar-lessons-btn"
                            type="button"
                            onClick={() => setActiveView("lessons")}
                          >
                            Naar algemene lessen
                          </button>
                        </section>

                        <ul className="challenge-list">
                          {isGetActiveAgain ? (
                            <>
                              <li>
                                Laagdrempelig opnieuw beginnen met sporten
                              </li>
                              <li>Focus op conditie en trainingsroutine</li>
                              <li>Trainingscredits op jouw account</li>
                              <li>Persoonlijke begeleiding van Tony</li>
                            </>
                          ) : (
                            <>
                              <li>Focus op kracht, conditie en vetverlies</li>
                              <li>Begin- en eindmeting</li>
                              <li>Voortgang bijhouden gedurende het traject</li>
                              <li>Persoonlijke begeleiding van Tony</li>
                            </>
                          )}
                        </ul>

                        <div className="active-challenge-message">
                          <strong>Plan je trainingen</strong>
                          <p>
                            Gebruik de credits op je account om jouw trainingen
                            via het tabblad Lessen in te plannen.
                          </p>
                        </div>

                        <button
                          className="primary-btn"
                          type="button"
                          onClick={() => setActiveView("lessons")}
                        >
                          Naar mijn lessen
                        </button>
                      </article>
                    );
                  })}
                </section>
              </>
            ) : (
              <>
                <section className="challenges-hero">
                  <p className="challenges-kicker">FitForest Challenges</p>
                  <h2>Kies jouw traject</h2>
                  <p>
                    Kies een challenge die aansluit bij jouw doel. Na aankoop
                    koppelt Tony het traject en de bijbehorende credits aan jouw
                    account.
                  </p>
                </section>

                <section className="challenge-grid">
                  <article className="challenge-card">
                    <div className="challenge-top">
                      <span className="challenge-badge">Beginner friendly</span>
                      <h3>Get Active Again Challenge</h3>
                      <p>
                        Voor mensen die opnieuw willen beginnen met sporten en
                        rustig willen werken aan conditie, ritme en
                        zelfvertrouwen.
                      </p>
                    </div>

                    <div className="challenge-info">
                      <div>
                        <span>Duur</span>
                        <strong>8 weken</strong>
                      </div>

                      <div>
                        <span>Inclusief</span>
                        <strong>Trainingscredits</strong>
                      </div>

                      <div>
                        <span>Prijs</span>
                        <strong>€70</strong>
                      </div>
                    </div>

                    <ul className="challenge-list">
                      <li>Startmeting en persoonlijk doel</li>
                      <li>Laagdrempelig trainingsprogramma</li>
                      <li>Focus op bewegen, conditie en routine</li>
                      <li>Persoonlijke begeleiding</li>
                    </ul>

                    <div className="challenge-price">
                      <span>Challengeprijs</span>
                      <strong>€70</strong>
                    </div>

                    <div className="challenge-contact">
                      Neem contact op met Tony om deze challenge te starten.
                    </div>
                  </article>

                  <article className="challenge-card featured-challenge">
                    <div className="challenge-top">
                      <span className="challenge-badge">Populair</span>
                      <h3>10-Week Body Transformation</h3>
                      <p>
                        Voor mensen die gestructureerd willen werken aan kracht,
                        conditie en zichtbare vooruitgang.
                      </p>
                    </div>

                    <div className="challenge-info">
                      <div>
                        <span>Duur</span>
                        <strong>10 weken</strong>
                      </div>

                      <div>
                        <span>Inclusief</span>
                        <strong>Trainingscredits</strong>
                      </div>

                      <div>
                        <span>Prijs</span>
                        <strong>€120</strong>
                      </div>
                    </div>

                    <ul className="challenge-list">
                      <li>Startmeting en eindmeting</li>
                      <li>Voortgangsfoto&apos;s en metingen</li>
                      <li>Focus op kracht, conditie en vetverlies</li>
                      <li>Persoonlijke begeleiding</li>
                    </ul>

                    <div className="challenge-price">
                      <span>Introprijs</span>
                      <strong>€120</strong>
                    </div>

                    <div className="challenge-contact">
                      Neem contact op met Tony om deze challenge te starten.
                    </div>
                  </article>
                </section>
              </>
            )}
          </section>
        )}

        {activeView === "customers" && profile?.role === "admin" && (
          <section className="view customers-view">
            <section className="customer-overview">
              <div className="customer-overview-header">
                <div>
                  <p className="admin-kicker">Klantenbeheer</p>
                  <h2>Klantenoverzicht</h2>
                  <p>Bekijk credits, boekingen en actieve challenges.</p>
                </div>

                <button
                  className="secondary-btn"
                  type="button"
                  onClick={loadCustomerOverview}
                >
                  Vernieuwen
                </button>
              </div>

              <input
                className="form-input customer-search"
                type="search"
                placeholder="Zoek op naam of e-mailadres"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
              />

              {loadingCustomers && (
                <div className="empty-box">
                  <strong>Klanten laden...</strong>
                </div>
              )}

              {!loadingCustomers && filteredCustomers.length === 0 && (
                <div className="empty-box">
                  <strong>Geen klanten gevonden</strong>
                  <span>
                    Er zijn nog geen klanten of je zoekopdracht heeft geen
                    resultaten.
                  </span>
                </div>
              )}

              <div className="customer-list">
                {filteredCustomers.map((customer) => (
                  <article className="customer-card" key={customer.user_id}>
                    <div className="customer-main">
                      <div>
                        <h3>{customer.username}</h3>
                        <p>{customer.email}</p>
                      </div>

                      <span className="customer-credit-count">
                        {customer.credits} credits
                      </span>
                    </div>

                    <div className="customer-stats">
                      <div>
                        <span>Credits</span>
                        <strong>{customer.credits}</strong>
                      </div>

                      <div>
                        <span>Boekingen</span>
                        <strong>{customer.booking_count}</strong>
                      </div>

                      <div>
                        <span>Challenges</span>
                        <strong>{customer.challenges.length}</strong>
                      </div>
                    </div>

                    <div className="customer-actions">
                      <p className="customer-action-title">Credits toevoegen</p>

                      <div className="quick-credit-buttons">
                        {[1, 5, 10, 20].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() =>
                              addCreditsFromOverview(customer.email, amount)
                            }
                          >
                            +{amount}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="customer-challenges">
                      <p className="customer-action-title">
                        Actieve challenges
                      </p>

                      {customer.challenges.length === 0 && (
                        <p className="muted-text">Geen actieve challenge.</p>
                      )}

                      <div className="customer-challenge-list">
                        {customer.challenges.map((challenge) => (
                          <div className="customer-challenge" key={challenge}>
                            <span>{getChallengeLabel(challenge)}</span>

                            <button
                              type="button"
                              onClick={() =>
                                removeChallenge(customer.user_id, challenge)
                              }
                            >
                              Verwijderen
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="challenge-assign-buttons">
                        {!customer.challenges.includes("get_active_again") && (
                          <button
                            type="button"
                            onClick={() =>
                              assignChallenge(
                                customer.user_id,
                                "get_active_again",
                              )
                            }
                          >
                            + Get Active Again
                          </button>
                        )}

                        {!customer.challenges.includes(
                          "body_transformation",
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              assignChallenge(
                                customer.user_id,
                                "body_transformation",
                              )
                            }
                          >
                            + Body Transformation
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
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
                      <label className="form-label">Starttijd</label>
                      <input
                        className="form-input"
                        type="time"
                        value={newTime}
                        onChange={(event) => setNewTime(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div>
                      <label className="form-label">Eindtijd</label>
                      <input
                        className="form-input"
                        type="time"
                        value={newEndTime}
                        onChange={(event) => setNewEndTime(event.target.value)}
                      />
                    </div>

                    <div>
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
                    </div>
                  </div>

                  <label className="form-label">Trainer</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Bijvoorbeeld Tony"
                    value={newTrainerName}
                    onChange={(event) => setNewTrainerName(event.target.value)}
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
