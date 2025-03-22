import React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DataCardProps {
  title: string;
  description?: string;
  className?: string;
  footerContent?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function DataCard({
  title,
  description,
  className,
  footerContent,
  children,
  icon,
}: DataCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center">
          {icon && <div className="flex-shrink-0 bg-primary/10 rounded-md p-3 mr-5">{icon}</div>}
          <div className={cn("w-0 flex-1", !icon && "ml-0")}>
            <CardTitle className="text-sm font-medium text-gray-500 truncate">{title}</CardTitle>
            <CardDescription>
              {children}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {description && (
        <CardContent className="p-4 sm:p-6 pt-0">
          <p className="text-sm text-gray-500">{description}</p>
        </CardContent>
      )}
      {footerContent && (
        <CardFooter className="bg-gray-50 p-4 sm:p-6">
          {footerContent}
        </CardFooter>
      )}
    </Card>
  );
}
