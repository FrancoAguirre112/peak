// components/ContactForm.tsx
"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";

// Define the structure of our form data for TypeScript
interface FormData {
  fullName: string;
  inquirerType: string;
  institution: string;
  location: string;
  phone: string;
  email: string;
  message: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gtmEvent = (eventName: string, eventData: Record<string, any>) => {
  // Ensure dataLayer is available to prevent errors during SSR or if GTM fails to load
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...eventData,
    });
  }
};

const ContactForm = () => {
  const searchParams = useSearchParams();

  // Read UTM params once and store in a ref (they don't change)
  const utmData = useRef({
    campaign: searchParams.get("utm_campaign") || searchParams.get("campaign_name") || "",
    adset: searchParams.get("utm_content") || searchParams.get("adset_name") || "",
    ad: searchParams.get("utm_term") || searchParams.get("ad_name") || "",
  });

  // State to hold the form values
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    inquirerType: "",
    institution: "",
    location: "",
    phone: "",
    email: "",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  // State to track if the user has started interacting with the form
  const [formStarted, setFormStarted] = useState(false);

  // A single handler to update state for any form field change
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Triggers the 'form_start' event on the first interaction with any form field
  const handleFocus = () => {
    if (!formStarted) {
      gtmEvent("form_start", { form_name: "contact_form" });
      setFormStarted(true); // Ensure the event only fires once
    }
  };

  // Handler for the form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent the default form submission behavior

    // Simple validation to ensure all fields are filled
    if (
      Object.values(formData).some((value) => value === "") ||
      formData.inquirerType === ""
    ) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    setIsSubmitting(true);

    // --- GTM Event Tracking ---
    // Fire the 'form_submit' event when validation passes
    gtmEvent("form_submit", { form_name: "contact_form" });

    // --- Send to Google Sheets ---
    try {
      // REPLACE THIS URL with your own Google Apps Script Web App URL
      const GOOGLE_SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbz0dtuNqOYKMTmwtTet_QB2l0gjHDQWd6_lChSiBILarhcn_t-xzyEieUIayNIwb1g/exec";

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        // 'no-cors' is needed when posting from the browser to Google Scripts directly
        // Note: You won't get a readable JSON response in 'no-cors' mode, but the data will send.
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...formData, ...utmData.current }),
      });

      // Optional: Clear form after successful submission logic if you weren't redirecting
      // setFormData({ ...EmptyState });
    } catch (error) {
      console.error("Error sending to Google Sheets", error);
      // You might want to decide if you still want to open WhatsApp if this fails
    } finally {
      setIsSubmitting(false);
    }

    // --- WhatsApp Logic (Existing) ---
    // The target WhatsApp number
    const whatsappNumber = "5491157671405";

    // Construct the message from the form data
    const message = `
¡Hola! Quisiera realizar una consulta:
----------------------------------
*Nombre y Apellido:* ${formData.fullName}
*Quién consulta:* ${formData.inquirerType}
*Colegio/Instituto/Club:* ${formData.institution}
*Localidad:* ${formData.location}
*Celular:* ${formData.phone}
*Mail:* ${formData.email}
----------------------------------
*Consulta:*
${formData.message}
    `.trim();

    // Encode the message for the URL
    const encodedMessage = encodeURIComponent(message);

    // Create the final WhatsApp URL
    const whatsappUrl = `https://api.whatsapp.com/send/?phone=${whatsappNumber}&text=${encodedMessage}`;

    // Open the URL in a new browser tab
    window.open(whatsappUrl, "_blank");
  };

  return (
    // Main container with responsive padding
    <div className="p-4 md:p-8 w-full font-sans">
      <div className="mx-auto max-w-7xl">
        {/* Form Header */}
        <div className="mb-8 lg:text-left text-center">
          <h2 className="font-bold text-red-600 text-3xl">
            Envíanos tu consulta
          </h2>
          <p className="mt-2 text-gray-600">
            Todos los campos son obligatorios*
          </p>
        </div>

        {/* Main layout: stacks on mobile, side-by-side on large screens */}
        <div className="flex lg:flex-row flex-col gap-12 lg:gap-8">
          {/* Left Side: The Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-6 w-full lg:w-2/3 text-black"
          >
            {/* Grid for inputs: stacks on mobile, two columns on medium screens up */}
            <div className="flex md:flex-row flex-col gap-6">
              {/* Left Column of Inputs */}
              <div className="space-y-6 w-full md:w-1/2">
                {/* Nombre y apellido */}
                <div>
                  <label
                    htmlFor="fullName"
                    className="block mb-1 font-medium text-gray-700 text-sm"
                  >
                    Nombre y apellido
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="shadow-sm p-2 border border-gray-300 focus:border-red-500 rounded-md focus:ring-red-500 w-full"
                  />
                </div>

                {/* Nombre del Colegio/Instituto/Club */}
                <div>
                  <label
                    htmlFor="institution"
                    className="block mb-1 font-medium text-gray-700 text-sm"
                  >
                    Nombre del Colegio/Instituto/Club
                  </label>
                  <input
                    type="text"
                    id="institution"
                    name="institution"
                    value={formData.institution}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="shadow-sm p-2 border border-gray-300 focus:border-red-500 rounded-md focus:ring-red-500 w-full"
                  />
                </div>

                {/* Celular */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block mb-1 font-medium text-gray-700 text-sm"
                  >
                    Celular
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="shadow-sm p-2 border border-gray-300 focus:border-red-500 rounded-md focus:ring-red-500 w-full"
                  />
                </div>
              </div>

              {/* Right Column of Inputs */}
              <div className="space-y-6 w-full md:w-1/2">
                {/* Quién realiza la consulta */}
                <div>
                  <label
                    htmlFor="inquirerType"
                    className="block mb-1 font-medium text-gray-700 text-sm"
                  >
                    Quién realiza la consulta
                  </label>
                  <select
                    id="inquirerType"
                    name="inquirerType"
                    value={formData.inquirerType}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="shadow-sm p-2 border border-gray-300 rounded-md w-full h-[42px]"
                  >
                    <option value="" disabled>
                      Selecciona una opción
                    </option>
                    <option value="Padre">Padre</option>
                    <option value="Alumno">Alumno</option>
                    <option value="Docente">Docente</option>
                  </select>
                </div>

                {/* Localidad */}
                <div>
                  <label
                    htmlFor="location"
                    className="block mb-1 font-medium text-gray-700 text-sm"
                  >
                    Localidad
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="shadow-sm p-2 border border-gray-300 focus:border-red-500 rounded-md focus:ring-red-500 w-full"
                  />
                </div>

                {/* Mail */}
                <div>
                  <label
                    htmlFor="email"
                    className="block mb-1 font-medium text-gray-700 text-sm"
                  >
                    Mail
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="shadow-sm p-2 border border-gray-300 focus:border-red-500 rounded-md focus:ring-red-500 w-full"
                  />
                </div>
              </div>
            </div>

            {/* Consulta Textarea */}
            <div>
              <label
                htmlFor="message"
                className="block mb-1 font-medium text-gray-700 text-sm"
              >
                Consulta
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                value={formData.message}
                onChange={handleChange}
                onFocus={handleFocus}
                className="shadow-sm p-2 border border-gray-300 focus:border-red-500 rounded-md focus:ring-red-500 w-full"
              />
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`bg-red-600 hover:bg-red-700 shadow-sm px-8 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 w-full sm:w-auto font-semibold text-white text-base transition-colors hover:cursor-pointer ${isSubmitting ? "opacity-70 cursor-wait" : ""}`}
              >
                {isSubmitting ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </form>

          {/* Right Side: Contact Info */}
          <div className="w-full lg:w-1/3">
            <div className="bg-gray-50/50 p-6 border border-gray-200 rounded-lg h-full">
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <span className="mt-1 text-2xl">⏰</span>
                  <div>
                    <h3 className="font-bold text-gray-800">
                      Horario de atención
                    </h3>
                    <p className="text-gray-600">
                      Lunes a viernes 10:00 a 13:00 y de 14:00 a 16:30 hs
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="mt-1 text-2xl">📍</span>
                  <div>
                    <h3 className="font-bold text-gray-800">Dirección</h3>
                    <p className="text-gray-600">
                      25 de Mayo 195, 5to Piso, Oficina A, Buenos Aires,
                      Argentina
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="mt-1 text-2xl">📧</span>
                  <div>
                    <h3 className="font-bold text-gray-800">Email</h3>
                    <p className="text-gray-600">info@peaktravel.com.ar</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="mt-1 text-2xl">☎️</span>
                  <div>
                    <h3 className="font-bold text-gray-800">Teléfono</h3>
                    <p className="text-gray-600">11 5256-8461</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactForm;
