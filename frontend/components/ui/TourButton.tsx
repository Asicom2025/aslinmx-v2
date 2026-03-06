"use client";

import { useTour, TourName } from "@/hooks/useTour";
import { FiHelpCircle } from "react-icons/fi";

interface TourButtonProps {
  tour: TourName;
  label?: string;
  className?: string;
}

export default function TourButton({ tour, label = "Ver guía", className }: TourButtonProps) {
  const { startTour } = useTour(tour);

  return (
    <button
      type="button"
      onClick={startTour}
      title={label}
      className={
        className ??
        "flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 transition-colors"
      }
    >
      <FiHelpCircle className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
