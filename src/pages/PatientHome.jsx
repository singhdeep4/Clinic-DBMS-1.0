import React, { useState } from "react";
import { putItem } from "../lib/db.js";

const clinics = [
  {
    id: "aayushree",
    name: "Aayushree Ayurved Polyclinic & Panchakarma Center",
    address: `Shop No. 1 & 2, Shreeyash Building,\nBehind Link View Hotel,\nPandit Malharrao Kulkarni Road,\nBorivali (West), Mumbai – 400092, Maharashtra`,
    days: "Monday • Wednesday • Friday",
    times: ["19:00", "19:30", "20:00", "20:30"],
    contact: "+91 7021272264"
  },
  {
    id: "aaroyam",
    name: "Aaroyam Panchakarma Centre",
    address: `Shop No. 1, Charkop Vidyut CHS,\nPlot No. 234, Sector 5,\nCharkop, Kandivali (West),\nMumbai – 400067, Maharashtra`,
    days: "Tuesday • Thursday",
    times: ["19:00", "19:30", "20:00", "20:30"],
    contact: "+91 9326973764 | +91 9152569247"
  },
  {
    id: "dubal",
    name: "Dubal's Clinic",
    address: `Plot No. 329, D-42, Ravi Park Co-operative Housing Society,\nNear Sector 3, Charkop,\nR.S.C. Road No. 32, Kandivali (West),\nMumbai – 400067, Maharashtra`,
    days: "Saturday",
    times: ["19:00", "19:30", "20:00", "20:30"],
    contact: "+91 7999253864"
  }
];

export default function PatientHome() {
  const [openClinic, setOpenClinic] = useState(null);
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [status, setStatus] = useState("");

  const openForm = (clinicId) => {
    setOpenClinic(clinicId);
    setName("");
    setTime("");
    setStatus("");
  };

  const submitBooking = async (clinic) => {
    if (!name.trim()) {
      setStatus("Please enter your name.");
      return;
    }
    if (!time) {
      setStatus("Please select a time.");
      return;
    }

    setStatus("Booking...");
    // Build queue item matching doctor's portal schema
    const newItem = {
      id: "Q-" + Date.now(),
      name: name.trim(),
      age: "",
      gender: "",
      mobile: "",
      reason: `Walk-in - ${clinic.name}`,
      status: "Waiting",
      timestamp: new Date().toISOString(),
      preferredTime: time || "Walk-in",
      clinicId: clinic.id,
      clinicName: clinic.name,
      source: "patient_home"
    };

    try {
      await putItem("queue", newItem);
      setStatus("Booked — you are added to the walk-in list.");
      setName("");
      setTime("");
    } catch (err) {
      console.error("Booking failed:", err);
      setStatus("Failed to book. Please try again later.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Book a Walk-in / Appointment</h1>
      <p className="mb-6 text-sm text-gray-700">Choose a clinic, add your name and select a time. No login required.</p>

      <div className="space-y-6">
        {clinics.map((c) => (
          <div key={c.id} className="p-4 border rounded bg-white shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">🌿 {c.name}</h2>
                <p className="text-sm whitespace-pre-line text-gray-700 mt-2">{c.address}</p>
                <p className="text-sm mt-2"><strong>Days:</strong> {c.days}</p>
                <p className="text-sm"><strong>Timings:</strong> 7:00 PM – 9:00 PM</p>
                <p className="text-sm"><strong>Contact:</strong> {c.contact}</p>
              </div>
              <div className="ml-4">
                <button className="bg-brand-primary text-white px-3 py-2 rounded" onClick={() => openForm(c.id)}>Book Appointment</button>
              </div>
            </div>

            {openClinic === c.id && (
              <div className="mt-4 border-t pt-4">
                <label className="block text-sm font-medium">Your Name</label>
                <input className="w-full border rounded p-2 mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />

                <label className="block text-sm font-medium mt-3">Select Time</label>
                <select className="w-full border rounded p-2 mt-1" value={time} onChange={e => setTime(e.target.value)}>
                  <option value="">-- choose a slot --</option>
                  {c.times.map(t => (
                    <option key={t} value={t}>{t} (7:00 PM format)</option>
                  ))}
                </select>

                <div className="flex items-center gap-2 mt-4">
                  <button className="bg-green-600 text-white px-3 py-2 rounded" onClick={() => submitBooking(c)}>Add to Walk-in List</button>
                  <button className="text-sm text-gray-600" onClick={() => setOpenClinic(null)}>Cancel</button>
                </div>
                {status && <p className="mt-3 text-sm text-gray-700">{status}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
