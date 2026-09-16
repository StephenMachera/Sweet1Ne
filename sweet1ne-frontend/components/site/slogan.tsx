import { openBookingModal } from "./booking-modal";

/** The close: the line, then one ghost Book. `#book` is what the header's
 *  Book links to on this page. */
export default function Slogan() {
  return (
    <section id="book" className="mood">
      <p>Always in the mood for you.</p>

      <button type="button" onClick={openBookingModal} className="book">
        Book a table
      </button>
    </section>
  );
}
