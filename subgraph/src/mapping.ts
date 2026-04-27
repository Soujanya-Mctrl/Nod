import { AgreementSealed, AgreementDeclined } from "../generated/Nod/Nod"
import { Agreement } from "../generated/schema"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleAgreementSealed(event: AgreementSealed): void {
  let agreement = new Agreement(event.params.agreementId.toHex())
  agreement.cid = event.params.cid
  agreement.initiator = event.params.initiator
  agreement.counterparty = event.params.counterparty
  agreement.status = 1 // Nodded
  agreement.timestamp = event.params.timestamp
  // In a real app, we'd store createdAt as well
  agreement.createdAt = event.block.timestamp 
  agreement.save()
}

export function handleAgreementDeclined(event: AgreementDeclined): void {
  let agreement = Agreement.load(event.params.agreementId.toHex())
  if (agreement) {
    agreement.status = 2 // Declined
    agreement.timestamp = event.params.timestamp
    agreement.save()
  }
}
