// components/ContactForm.tsx
"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";

declare global {
  interface Window {
    // GA4's gtag, bound to its own "gaDataLayer" (see app/layout.tsx)
    gtag?: (...args: unknown[]) => void;
  }
}

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

type FieldName = keyof FormData;

// Fields in the order they appear on screen (left column, right column,
// message), so the first missing one is the one we scroll to.
const FIELDS: { name: FieldName; label: string }[] = [
  { name: "fullName", label: "Nombre y apellido" },
  { name: "institution", label: "Colegio/Instituto/Club" },
  { name: "phone", label: "Celular" },
  { name: "inquirerType", label: "Quién realiza la consulta" },
  { name: "location", label: "Localidad" },
  { name: "email", label: "Mail" },
  { name: "message", label: "Consulta" },
];

const FieldError = ({ name, show }: { name: FieldName; show?: boolean }) =>
  show ? (
    <p id={`${name}-error`} className="mt-1 font-medium text-red-600 text-sm">
      Completá este campo
    </p>
  ) : null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gtmEvent =(eventName: string, eventData: Record<string, any>) => {
  // Ensure dataLayer is available to prevent errors during SSR or if GTM fails to load
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...eventData,
    });
  }
  // Send the same event to GA4 directly (gtag). It goes to GA4's own
  // dataLayer, so GTM doesn't see it and the Meta tags fire only once.
  if (typeof window !== "undefined") window.gtag?.("event", eventName, eventData);
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

  // Last payload sent to Sheets/GA, to avoid logging the same lead twice
  const lastSubmittedRef = useRef<string | null>(null);
  // WhatsApp link shown after submit, as a fallback when window.open is blocked
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  // State to track if the user has started interacting with the form
  const [formStarted, setFormStarted] = useState(false);
  // Fields left empty on the last submit attempt
  const [errors, setErrors] = useState<Partial<Record<FieldName, boolean>>>({});
  const missingLabels = FIELDS.filter((f) => errors[f.name]).map((f) => f.label);

  // Red border + background and a11y wiring for a field left empty
  const fieldProps = (name: FieldName, extra = "") => ({
    "aria-invalid": errors[name] || undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    className: `shadow-sm p-2 border rounded-md w-full focus:border-red-500 focus:ring-red-500 ${
      errors[name] ? "border-red-500 bg-red-50 ring-1 ring-red-500" : "border-gray-300"
    } ${extra}`,
  });

  // A single handler to update state for any form field change
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    // Clear the field's error as soon as the user fills it in
    if (errors[name as FieldName] && value.trim() !== "") {
      setErrors((prev) => ({ ...prev, [name]: false }));
    }
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

    // Every field is required: mark the empty ones in red and take the user
    // to the first one, instead of a generic alert that doesn't say which.
    const missing = FIELDS.filter((f) => formData[f.name].trim() === "");
    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((f) => [f.name, true])));
      const first = document.getElementById(missing[0].name);
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.focus({ preventScroll: true });
      // GA4 only (not GTM/Meta): how often and where people get stuck
      window.gtag?.("event", "form_invalid", {
        form_name: "contact_form",
        missing_fields: missing.map((f) => f.name).join(","),
      });
      return;
    }
    setErrors({});

    const payload = JSON.stringify({ ...formData, ...utmData.current });

    // Users often tap again when WhatsApp doesn't open (e.g. in-app browsers
    // from Instagram/Facebook ads). If the data is unchanged, just reopen
    // WhatsApp without logging a duplicate lead or conversion.
    if (lastSubmittedRef.current !== payload) {
      lastSubmittedRef.current = payload;

      // --- GTM Event Tracking ---
      // Fire the 'form_submit' event when validation passes
      gtmEvent("form_submit", { form_name: "contact_form" });

      // --- Send to Google Sheets ---
      // WhatsApp opens right after this. On phones (above all inside the
      // Instagram/Facebook in-app browser) leaving the page cancelled the old
      // fire-and-forget fetch, so leads never reached the Sheet. sendBeacon is
      // queued by the browser itself and survives the page going away. The
      // body is the same text/plain JSON the fetch sent (no-cors drops the
      // application/json header), so the Apps Script reads it unchanged.
      const GOOGLE_SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbz0dtuNqOYKMTmwtTet_QB2l0gjHDQWd6_lChSiBILarhcn_t-xzyEieUIayNIwb1g/exec";

      const queued =
        typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon(
          GOOGLE_SCRIPT_URL,
          new Blob([payload], { type: "text/plain;charset=UTF-8" }),
        );

      if (!queued) {
        fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          body: payload,
          keepalive: true,
        }).catch((error) => {
          console.error("Error sending to Google Sheets", error);
        });
      }
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
${utmData.current.ad ? `\n*Vengo del anuncio:* ${utmData.current.ad}` : ""}
    `.trim();

    // Encode the message for the URL
    const encodedMessage = encodeURIComponent(message);

    // Create the final WhatsApp URL
    const url = `https://api.whatsapp.com/send/?phone=${whatsappNumber}&text=${encodedMessage}`;
    setWhatsappUrl(url);

    // Open the URL in a new browser tab
    window.open(url, "_blank");
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
                    {...fieldProps("fullName")}
                  />
                  <FieldError name="fullName" show={errors.fullName} />
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
                    {...fieldProps("institution")}
                  />
                  <FieldError name="institution" show={errors.institution} />
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
                    {...fieldProps("phone")}
                  />
                  <FieldError name="phone" show={errors.phone} />
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
                    {...fieldProps("inquirerType", "h-[42px]")}
                  >
                    <option value="" disabled>
                      Selecciona una opción
                    </option>
                    <option value="Padre">Padre</option>
                    <option value="Alumno">Alumno</option>
                    <option value="Docente">Docente</option>
                  </select>
                  <FieldError name="inquirerType" show={errors.inquirerType} />
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
                    {...fieldProps("location")}
                  />
                  <FieldError name="location" show={errors.location} />
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
                    {...fieldProps("email")}
                  />
                  <FieldError name="email" show={errors.email} />
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
                {...fieldProps("message")}
              />
              <FieldError name="message" show={errors.message} />
            </div>

            {/* What's still missing, right above the button */}
            {missingLabels.length > 0 && (
              <p
                role="alert"
                className="bg-red-50 p-3 border border-red-300 rounded-md text-red-700 text-sm"
              >
                Para enviar tu consulta falta completar:{" "}
                <strong>{missingLabels.join(", ")}</strong>
              </p>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 shadow-sm px-8 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 w-full sm:w-auto font-semibold text-white text-base transition-colors hover:cursor-pointer"
              >
                Enviar solicitud
              </button>
            </div>

            {/* Confirmation + fallback link in case WhatsApp didn't open */}
            {whatsappUrl && (
              <p
                role="status"
                className="bg-green-50 p-4 border border-green-200 rounded-md text-green-800 text-sm"
              >
                ¡Recibimos tus datos! Si WhatsApp no se abrió,{" "}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline"
                >
                  tocá acá para enviarnos tu consulta
                </a>
                .
              </p>
            )}
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
