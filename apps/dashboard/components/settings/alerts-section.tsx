"use client"

import {
  ALERT_WEBHOOK_KINDS,
  type AlertWebhook,
  type AlertWebhookKind,
} from "@traceforge/event-schema"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@traceforge/ui/components/alert-dialog"
import { Badge } from "@traceforge/ui/components/badge"
import { Button } from "@traceforge/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@traceforge/ui/components/card"
import { Field, FieldError, FieldLabel } from "@traceforge/ui/components/field"
import { Input } from "@traceforge/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@traceforge/ui/components/select"
import { Spinner } from "@traceforge/ui/components/spinner"
import { Switch } from "@traceforge/ui/components/switch"
import { SendIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { useAlertWebhooks } from "./use-alert-webhooks"

const KIND_LABELS: Record<AlertWebhookKind, string> = { generic: "Generic", slack: "Slack" }
const KIND_ITEMS = ALERT_WEBHOOK_KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))

function WebhookRow({ projectId, webhook }: { projectId: string; webhook: AlertWebhook }) {
  const { mutate, sendTest, pending, toast } = useAlertWebhooks(projectId)
  const [testing, setTesting] = useState(false)

  async function toggle(
    field: "enabled" | "notifyOnNewIssue" | "notifyOnRegression",
    value: boolean
  ) {
    const result = await mutate("PATCH", `/${webhook.id}`, { [field]: value })
    if (!result.ok) toast.error(result.message)
  }

  async function remove() {
    const result = await mutate("DELETE", `/${webhook.id}`)
    if (result.ok) toast.success("Webhook removed")
    else toast.error(result.message)
  }

  async function test() {
    setTesting(true)
    const result = await sendTest(webhook.id)
    setTesting(false)
    if (result.ok) toast.success("Test alert sent")
    else toast.error(result.message ?? "Delivery failed")
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary">{KIND_LABELS[webhook.kind]}</Badge>
          <span className="truncate font-mono text-xs text-muted-foreground">{webhook.url}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={test}
            disabled={testing || pending}
          >
            {testing ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
            Send test
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete webhook" />
              }
            >
              <Trash2Icon />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this webhook?</AlertDialogTitle>
                <AlertDialogDescription>
                  TraceForge stops notifying this URL immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <Button variant="destructive" onClick={remove} disabled={pending}>
                  {pending && <Spinner data-icon="inline-start" />}
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor={`${webhook.id}-enabled`} className="text-xs">
            Enabled
          </FieldLabel>
          <Switch
            id={`${webhook.id}-enabled`}
            checked={webhook.enabled}
            onCheckedChange={(value) => toggle("enabled", value)}
            disabled={pending}
          />
        </Field>
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor={`${webhook.id}-new`} className="text-xs">
            New issue
          </FieldLabel>
          <Switch
            id={`${webhook.id}-new`}
            checked={webhook.notifyOnNewIssue}
            onCheckedChange={(value) => toggle("notifyOnNewIssue", value)}
            disabled={pending}
          />
        </Field>
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor={`${webhook.id}-regression`} className="text-xs">
            Regression
          </FieldLabel>
          <Switch
            id={`${webhook.id}-regression`}
            checked={webhook.notifyOnRegression}
            onCheckedChange={(value) => toggle("notifyOnRegression", value)}
            disabled={pending}
          />
        </Field>
      </div>
    </div>
  )
}

const HTTPS_URL = /^https:\/\//

function AddWebhookForm({ projectId }: { projectId: string }) {
  const { mutate, pending, toast } = useAlertWebhooks(projectId)
  const [url, setUrl] = useState("")
  const [kind, setKind] = useState<AlertWebhookKind>("generic")
  const [error, setError] = useState<string | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!HTTPS_URL.test(url.trim())) return setError("Enter an https:// URL.")
    setError(null)
    const result = await mutate("POST", "", { url: url.trim(), kind })
    if (result.ok) {
      toast.success("Webhook added")
      setUrl("")
      setKind("generic")
    } else toast.error(result.message)
  }

  return (
    <form
      onSubmit={save}
      noValidate
      className="flex w-full flex-col gap-3 sm:flex-row sm:items-end"
    >
      <Field data-invalid={!!error || undefined} className="flex-1">
        <FieldLabel htmlFor="webhook-url">Webhook URL</FieldLabel>
        <Input
          id="webhook-url"
          type="url"
          placeholder="https://hooks.slack.com/services/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={!!error || undefined}
          disabled={pending}
        />
        <FieldError>{error}</FieldError>
      </Field>
      <Field className="sm:w-36">
        <FieldLabel htmlFor="webhook-kind">Kind</FieldLabel>
        <Select
          items={KIND_ITEMS}
          value={kind}
          onValueChange={(value) => setKind(value as AlertWebhookKind)}
        >
          <SelectTrigger id="webhook-kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {KIND_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" disabled={pending || !url.trim()}>
        {pending && <Spinner data-icon="inline-start" />}
        Add webhook
      </Button>
    </form>
  )
}

export function AlertsSection({
  projectId,
  webhooks,
}: {
  projectId: string
  webhooks: AlertWebhook[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert webhooks</CardTitle>
        <CardDescription>
          Get notified on a generic webhook or Slack when a new issue appears or a resolved issue
          regresses.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alert webhooks yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {webhooks.map((webhook) => (
              <WebhookRow key={webhook.id} projectId={projectId} webhook={webhook} />
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col items-stretch">
        <AddWebhookForm projectId={projectId} />
      </CardFooter>
    </Card>
  )
}
