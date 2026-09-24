import Link from "next/link";
import { ChevronRight, Cpu, ShieldCheck } from "lucide-react";
import { CourseListItem } from "@/types";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";

interface CourseCardProps {
  course: CourseListItem;
  certificateLabel?: string;
}

export function CourseCard({
  course,
  certificateLabel = "Academic Certificate",
}: CourseCardProps) {
  return (
    <Card className="flex flex-col border-border-subtle hover:border-primary/40 hover:shadow-[0_2px_8px_rgba(40,56,135,0.06)] transition-all group overflow-hidden">
      <div className="h-36 bg-primary-dark text-white p-4 flex flex-col justify-between relative border-b border-border-subtle">
        <div className="flex justify-between items-start">
          <span className="font-mono text-xs font-semibold text-white bg-white/15 px-2 py-0.5 rounded">
            {course.course_code}
          </span>
          <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded text-slate-200 font-medium">
            {course.estimated_duration || "Self-Paced"}
          </span>
        </div>
        <div>
          <Cpu className="w-6 h-6 text-primary-steel mb-1.5 opacity-90" />
          <div className="text-[11px] text-slate-300 font-medium">
            Department of ECE
          </div>
        </div>
      </div>

      <CardHeader className="space-y-1.5 flex-1 p-4 pb-2">
        <CardTitle className="text-[15px] font-semibold text-text-primary group-hover:text-primary transition-colors leading-snug line-clamp-2">
          {course.title}
        </CardTitle>
        <CardDescription className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
          {course.short_description ||
            "Comprehensive hands-on study for electronics engineers."}
        </CardDescription>
        {course.instructor_name && (
          <div className="text-xs text-text-secondary pt-1">
            Instructor:{" "}
            <span className="text-text-primary font-medium">
              {course.instructor_name}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 pb-3 px-4">
        <div className="grid grid-cols-3 gap-2 py-2 px-2 bg-[#F7F8FA] rounded-lg text-center text-text-secondary border border-border-subtle">
          <div>
            <div className="text-xs font-semibold text-text-primary">
              {course.module_count}
            </div>
            <div className="text-[10px] text-text-muted">Modules</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-text-primary">
              {course.lecture_count}
            </div>
            <div className="text-[10px] text-text-muted">Lectures</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-text-primary">
              {course.quiz_count}
            </div>
            <div className="text-[10px] text-text-muted">Quizzes</div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-2 pb-3 px-4 border-t border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-1 text-[11px] text-primary font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span>{certificateLabel}</span>
        </div>
        <Link href={`/courses/${course.id}`}>
          <Button size="sm" variant="default" className="gap-1 h-8 text-xs">
            <span>View Course</span>
            <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
