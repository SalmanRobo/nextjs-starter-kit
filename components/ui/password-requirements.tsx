"use client";

import { useMemo } from "react";
import { Check, X, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
  priority: "high" | "medium" | "low";
}

interface PasswordRequirementsProps {
  password: string;
  className?: string;
  showStrengthScore?: boolean;
}

const requirements: PasswordRequirement[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (pwd) => pwd.length >= 8,
    priority: "high",
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (pwd) => /[A-Z]/.test(pwd),
    priority: "high",
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (pwd) => /[a-z]/.test(pwd),
    priority: "high",
  },
  {
    id: "number",
    label: "One number",
    test: (pwd) => /\d/.test(pwd),
    priority: "medium",
  },
  {
    id: "special",
    label: "One special character",
    test: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    priority: "medium",
  },
  {
    id: "length12",
    label: "12+ characters (recommended)",
    test: (pwd) => pwd.length >= 12,
    priority: "low",
  },
];

function getPasswordStrength(password: string): {
  score: number;
  level: "weak" | "fair" | "good" | "strong";
  color: string;
} {
  if (!password) return { score: 0, level: "weak", color: "text-muted-foreground" };
  
  const passedRequirements = requirements.filter(req => req.test(password));
  const score = (passedRequirements.length / requirements.length) * 100;
  
  if (score < 40) return { score, level: "weak", color: "text-destructive" };
  if (score < 60) return { score, level: "fair", color: "text-warning" };
  if (score < 80) return { score, level: "good", color: "text-blue-600" };
  return { score, level: "strong", color: "text-success" };
}

export function PasswordRequirements({ 
  password, 
  className,
  showStrengthScore = true 
}: PasswordRequirementsProps) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passedRequirements = useMemo(() => 
    requirements.filter(req => req.test(password)), 
    [password]
  );

  if (!password) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {showStrengthScore && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-medium text-muted-foreground">
              Password strength:
            </span>
            <Badge variant="outline" className={cn("text-2xs font-semibold", strength.color)}>
              {strength.level.charAt(0).toUpperCase() + strength.level.slice(1)}
            </Badge>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className={cn(
                "h-2 rounded-full transition-all duration-500 ease-out",
                strength.level === "weak" && "bg-destructive",
                strength.level === "fair" && "bg-warning", 
                strength.level === "good" && "bg-blue-500",
                strength.level === "strong" && "bg-success"
              )}
              style={{ width: `${Math.max(10, strength.score)}%` }}
            />
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <h4 className="text-2xs font-semibold text-foreground flex items-center gap-2">
          <AlertCircle className="h-3 w-3" />
          Password Requirements
        </h4>
        
        <div className="grid grid-cols-1 gap-2">
          {requirements.map((req) => {
            const passed = req.test(password);
            return (
              <div
                key={req.id}
                className={cn(
                  "flex items-center space-x-2 text-2xs transition-colors duration-200",
                  passed ? "text-success" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 w-3 h-3 rounded-full flex items-center justify-center transition-all duration-200",
                  passed 
                    ? "bg-success text-success-foreground shadow-sm" 
                    : "bg-muted border border-border"
                )}>
                  {passed ? (
                    <Check className="h-2 w-2" strokeWidth={3} />
                  ) : (
                    <X className="h-2 w-2 text-muted-foreground/60" strokeWidth={2} />
                  )}
                </div>
                <span className={cn(
                  "transition-colors duration-200",
                  passed ? "font-medium" : "font-normal"
                )}>
                  {req.label}
                </span>
                {req.priority === "low" && (
                  <Badge variant="secondary" className="text-2xs px-1.5 py-0">
                    optional
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {passedRequirements.length >= 4 && (
          <div className="mt-4 p-2 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center space-x-2 text-2xs text-success">
              <Check className="h-3 w-3 flex-shrink-0" />
              <span className="font-medium">Great! Your password meets our security standards.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}