import type { Metadata } from "next";
import { OrderChoice } from "@/components/site/order-choice";

export const metadata: Metadata = {
  title: "Order",
  description: "Order at your table, or for collection from Lewisham or Chingford.",
};

export default function OrderPage() {
  return <OrderChoice />;
}