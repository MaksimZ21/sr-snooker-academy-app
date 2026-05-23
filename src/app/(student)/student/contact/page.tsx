import { StudentContactForm } from "@/components/student-contact-form";

export default function StudentContactPage() {
  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">פנייה לאדמין</h1>
      <p className="text-muted-foreground mb-6">שלח שאלה או הודעה לצוות האקדמיה</p>
      <StudentContactForm />
    </div>
  );
}
