import { openBookingModal } from "./booking-modal";
export default function Slogan() {
  return (
    <section id="book" className="mood slogan">
      <p>Always in the mood for you.</p>

      <button type="button" onClick={openBookingModal} className="book slogan-button">
        Book a table
      </button>
    </section>
  );
}