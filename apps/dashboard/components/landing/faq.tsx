import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@traceforge/ui/components/accordion"
import Link from "next/link"

import { GITHUB_URL } from "./site-header"

const FAQS = [
  {
    question: "Is TraceForge free?",
    answer:
      "Yes. It's MIT licensed with no paid tier — sign up on the hosted instance to try it in minutes, or self-host your own for full control over your infrastructure and data.",
  },
  {
    question: "Do I have to self-host it?",
    answer:
      "No. You can create a project on the hosted instance and start sending events right away. Self-hosting is there if you want your data on infrastructure you control — the guide covers both.",
  },
  {
    question: "Which frameworks are supported?",
    answer:
      "Any site that can load a script, via the core SDK. React gets an error boundary for render errors, and Next.js gets a server-side hook for Server Components, Route Handlers and Server Actions — both in the same package.",
  },
  {
    question: "What data does it collect?",
    answer:
      "Technical context only: error details, request URLs with query values redacted, Web Vitals, route changes, and coarse browser/device info. No input values, cookies, headers or request bodies. See the Privacy section above for the full list.",
  },
  {
    question: "Can I delete my data?",
    answer:
      "Yes — delete a project any time from its Settings, which removes it and its events. Self-hosting gives you the database directly if you need more control than that.",
  },
] as const

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 id="faq-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Questions
        </h2>
        <p className="text-muted-foreground">
          Anything else, the{" "}
          <Link href="/guide" className="underline underline-offset-4 hover:text-foreground">
            guide
          </Link>{" "}
          or the{" "}
          <a href={GITHUB_URL} className="underline underline-offset-4 hover:text-foreground">
            source
          </a>{" "}
          will have an answer.
        </p>
      </div>
      <Accordion className="mt-8 max-w-3xl" multiple>
        {FAQS.map((faq) => (
          <AccordionItem key={faq.question} value={faq.question}>
            <AccordionTrigger className="text-base font-medium">{faq.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
