import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
import { AuthGuard } from "shia2n-core";
import { APP_ID, APP_NAME } from "./constants.js";
import App from "./App.jsx";
import BookingForm    from "./screens/BookingForm.jsx";
import BookingConfirm from "./screens/BookingConfirm.jsx";
import BookingCancel  from "./screens/BookingCancel.jsx";
import CalendarAdmin  from "./screens/admin/CalendarAdmin.jsx";
import EventTypesAdmin from "./screens/admin/EventTypesAdmin.jsx";

function Root() {
  const { pathname } = useLocation();
  const isPublic = pathname.startsWith("/book/");

  if (isPublic) {
    return (
      <Routes>
        <Route path="/book/:slug/confirm" element={<BookingConfirm />} />
        <Route path="/book/cancel/:token"  element={<BookingCancel />} />
        <Route path="/book/:slug"          element={<BookingForm />} />
      </Routes>
    );
  }

  return (
    <AuthGuard appId={APP_ID} appName={APP_NAME}>
      <Routes>
        <Route path="/admin/calendar"    element={<CalendarAdmin />} />
        <Route path="/admin/event-types" element={<EventTypesAdmin />} />
        <Route path="*"                  element={<App />} />
      </Routes>
    </AuthGuard>
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Root />
  </BrowserRouter>
);
