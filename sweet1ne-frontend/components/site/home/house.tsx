import Link from "next/link";
import { BookTableButton } from "@/components/site/booking-modal";

/**
 * The culinary beat, in a bordered panel.
 *
 * `house` and `acts` are what site.css's homepage rules key on — the
 * bordered frame, the dek measure and the ghost buttons are all
 * `.home-page .house …` selectors. The frame is three rules rather than
 * one: a gold hairline, a dark gap, then a fainter gold line inside it,
 * set with inset shadows so it needs no extra markup.
 */
export default function House() {
  return (
    <section className="house relative z-[8] mx-4 mb-[1.6rem] max-w-[40rem] px-[1.15rem] pb-[1.85rem] pt-[1.2rem] text-center border border-[rgba(201,162,74,0.42)] [box-shadow:inset_0_0_0_6px_#050505,inset_0_0_0_7px_rgba(201,162,74,0.22)] sm:mx-auto sm:mb-8 sm:px-6 sm:pb-[2.2rem] sm:pt-[1.4rem]">
      {/* Body face rather than display — this is the plain-spoken half, and
          the serif would make it read as a pull quote. */}
      <p className="dek mx-auto mb-[1.65rem] max-w-[32rem] text-[0.95rem]">
        Our journey began with a passion for bringing people together over dishes
        that resonate with history, culture and heart.
      </p>

      <p className="dek mx-auto mb-[1.65rem] max-w-[32rem] text-[0.95rem]">
        We reimagine the flavours of African, Caribbean and American soul food
        honouring generations of culinary wisdom, then elevating every recipe into
        a modern dining experience. At the centre of the kitchen is uncompromised
        craft: sea-fresh catches, sun-ripened spices, every plate telling a story.
        A feast for all five senses. Sweet1NE is a celebration of flavour,
        tradition and togetherness.
      </p>

      <div className="acts">
        <Link className="book" href="/menu">
          The menu
        </Link>

        {/* The live Book control — the branch modal, then SevenRooms. The
            template's href="#book" was a placeholder that went nowhere. */}
        <Link href="/locations" className="book">
            Book a table
          </Link>
      </div>
    </section>
  );
}
