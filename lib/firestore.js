import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Users ──────────────────────────────────────────────────────────────────────

export const addUserProfile = async (uid, data) => {
  await setDoc(doc(db, "users", uid), { ...data, createdAt: serverTimestamp() });
};

export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getAllUsers = async () => {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateUserProfile = async (uid, data) => {
  await updateDoc(doc(db, "users", uid), data);
};

export const deleteUserProfile = async (uid) => {
  await deleteDoc(doc(db, "users", uid));
};

// ── Clients ────────────────────────────────────────────────────────────────────

export const addClient = async (data) => {
  const ref = await addDoc(collection(db, "clients"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getClient = async (id) => {
  const snap = await getDoc(doc(db, "clients", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateClient = async (id, data) => {
  await updateDoc(doc(db, "clients", id), data);
};

export const deleteClient = async (id) => {
  await deleteDoc(doc(db, "clients", id));
};

export const getClientsByAssignee = async (uid) => {
  const q = query(
    collection(db, "clients"),
    where("assignedTo", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => !c.archived);
};

export const getArchivedClientsByAssignee = async (uid) => {
  const q = query(
    collection(db, "clients"),
    where("assignedTo", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.archived === true);
};

// ── Meetings ───────────────────────────────────────────────────────────────────

export const addMeeting = async (data) => {
  const meetingDate = new Date(data.date);
  const ref = await addDoc(collection(db, "meetings"), {
    ...data,
    date: Timestamp.fromDate(meetingDate),
    completed: meetingDate < new Date() ? true : null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getMeetingsByAssignee = async (uid) => {
  const q = query(
    collection(db, "meetings"),
    where("assignedTo", "==", uid),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getMeetingsByClient = async (clientId) => {
  const q = query(
    collection(db, "meetings"),
    where("clientId", "==", clientId),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateMeeting = async (id, data) => {
  await updateDoc(doc(db, "meetings", id), {
    ...data,
    ...(data.date ? { date: Timestamp.fromDate(new Date(data.date)) } : {}),
  });
};

export const deleteMeeting = async (id) => {
  await deleteDoc(doc(db, "meetings", id));
};

// ── Messaging Groups ───────────────────────────────────────────────────────────

export const addMessagingGroup = async (data) => {
  const ref = await addDoc(collection(db, "messagingGroups"), {
    ...data,
    clientIds: data.clientIds || [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getMessagingGroupsByAssignee = async (uid) => {
  const q = query(
    collection(db, "messagingGroups"),
    where("assignedTo", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getMessagingGroup = async (id) => {
  const snap = await getDoc(doc(db, "messagingGroups", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateMessagingGroup = async (id, data) => {
  await updateDoc(doc(db, "messagingGroups", id), data);
};

export const deleteMessagingGroup = async (id) => {
  await deleteDoc(doc(db, "messagingGroups", id));
};

// ── Message Templates ──────────────────────────────────────────────────────────

export const addMessageTemplate = async (data) => {
  const ref = await addDoc(collection(db, "messageTemplates"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getMessageTemplatesByAssignee = async (uid) => {
  const q = query(
    collection(db, "messageTemplates"),
    where("assignedTo", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateMessageTemplate = async (id, data) => {
  await updateDoc(doc(db, "messageTemplates", id), data);
};

export const deleteMessageTemplate = async (id) => {
  await deleteDoc(doc(db, "messageTemplates", id));
};
