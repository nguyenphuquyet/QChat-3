import { toast } from "sonner";
import { errorMessage } from "./utils";

export async function runAction(
  action: () => Promise<void>,
  success?: string,
): Promise<boolean> {
  try {
    await action();
    if (success) toast.success(success);
    return true;
  } catch (error) {
    toast.error(errorMessage(error));
    return false;
  }
}
