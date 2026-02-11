import { Dialog } from "@opencode-ai/ui/dialog"
import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLanguage } from "@/context/language"

interface DialogConfirmProps {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
}

export function DialogConfirm(props: DialogConfirmProps) {
  const dialog = useDialog()
  const language = useLanguage()

  const handleConfirm = () => {
    props.onConfirm()
    dialog.close()
  }

  const handleCancel = () => {
    props.onCancel?.()
    dialog.close()
  }

  return (
    <Dialog title={props.title} fit>
      <div class="flex flex-col gap-4 pl-6 pr-2.5 pb-3 min-w-[200px]">
        {props.description && (
          <div class="text-text-base text-14-regular">
            {props.description}
          </div>
        )}
        <div class="flex justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={handleCancel}>
            {props.cancelText || language.t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={handleConfirm} autofocus>
            {props.confirmText || language.t("common.confirm")}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
