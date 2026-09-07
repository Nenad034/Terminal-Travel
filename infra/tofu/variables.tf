variable "hcloud_token" {
  description = "Hetzner API kljuc. NIKAD se ne upisuje u repozitorijum — cita se iz promenljive okruzenja TF_VAR_hcloud_token."
  type        = string
  sensitive   = true
}

variable "ssh_javni_kljuc" {
  description = "Javni deo SSH kljuca administratora (sadrzaj ~/.ssh/id_ed25519.pub)."
  type        = string
}

variable "ssh_dozvoljene_adrese" {
  description = "Sa kojih internet adresa se sme uci na server preko SSH-a. Namerno NIJE ceo internet."
  type        = list(string)
}

variable "okruzenje" {
  description = "test ili produkcija — ulazi u naziv servera da se ne pomesaju."
  type        = string
  default     = "test"
}

variable "tip_servera" {
  description = "Hetzner plan. CX33 = 4 jezgra / 8 GB / 80 GB, ~8,49 EUR mesecno (provereno 7.9.2026)."
  type        = string
  default     = "cx33"
}

variable "lokacija" {
  description = "Hetzner lokacija. MORA biti u EU (Master dokument, poglavlje 9): nbg1/fsn1 Nemacka, hel1 Finska."
  type        = string
  default     = "nbg1"

  validation {
    condition     = contains(["nbg1", "fsn1", "hel1"], var.lokacija)
    error_message = "Lokacija mora biti u EU (nbg1, fsn1 ili hel1) — poglavlje 9 Master dokumenta trazi da podaci fizicki budu u EU."
  }
}

variable "velicina_diska_gb" {
  description = "Velicina odvojenog diska za bazu, u GB. Hetzner naplacuje ~0,0572 EUR po GB mesecno."
  type        = number
  default     = 50
}
