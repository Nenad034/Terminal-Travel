# Opis servera u kodu (poslednja nezatvorena stavka Faze 0 — M1 izlazni kriterijum:
# "Infrastruktura se dize iz IaC koda, ne rucnim koracima").
#
# Alat: OpenTofu. Poglavlje 6 Master dokumenta trazi "infrastrukturu kao kod" ali ne imenuje
# alat; izbor je obrazlozen u infra/README.md i upisan u poglavlje 6 istim prolazom.
#
# Sve sto ovde stoji je NAMERA, ne izvrsenje — dok se `tofu apply` ne pokrene sa vaznim
# API kljucem, nista se ne zakupljuje i nista se ne naplacuje.

terraform {
  required_version = ">= 1.6"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.48"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

# Kljuc kojim se ulazi na server. Lozinke se namerno ne koriste — SSH kljuc se ne moze
# pogoditi napadom grubom silom, za razliku od lozinke.
resource "hcloud_ssh_key" "admin" {
  name       = "terminal-admin"
  public_key = var.ssh_javni_kljuc
}

# Firewall: spolja su otvorena TACNO tri ulaza. Sve ostalo je zatvoreno po pravilu
# "zatvoreno dok se izricito ne otvori" — isti princip koji je 7.9.2026 primenjen i na
# API rute (M1 spec §3.7a).
resource "hcloud_firewall" "terminal" {
  name = "terminal-firewall"

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "22"
    # SSH je ogranicen na poznate adrese, ne na ceo internet. Ako se administratorska
    # adresa promeni (drugi internet), ovde se upisuje nova — namerno rucno, jer je to
    # jedina brava izmedju interneta i pune kontrole nad masinom.
    source_ips = var.ssh_dozvoljene_adrese
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"] # samo da preusmeri na HTTPS i da Let's Encrypt potvrdi domen
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

# Odvojen disk za bazu, nezavisan od samog servera. Razlog: server se sme obrisati i
# napraviti iznova (to je i smisao infrastrukture kao koda), a podaci pri tom NE SMEJU
# nestati. Da baza sedi na disku servera, brisanje servera bi odnelo i nju.
resource "hcloud_volume" "podaci" {
  name     = "terminal-podaci"
  size     = var.velicina_diska_gb
  location = var.lokacija
  format   = "ext4"
}

resource "hcloud_server" "terminal" {
  name         = "terminal-${var.okruzenje}"
  server_type  = var.tip_servera
  image        = "debian-12"
  location     = var.lokacija # EU — zahtev iz Master dokumenta, poglavlje 9
  ssh_keys     = [hcloud_ssh_key.admin.id]
  firewall_ids = [hcloud_firewall.terminal.id]

  # Hetzner-ove automatske dnevne kopije celog servera. NIJE zamena za nas backup baze
  # (infra/skripte/backup.sh) nego drugi sloj: ovo vraca celu masinu, ono vraca podatke.
  backups = true

  user_data = file("${path.module}/prvo-podesavanje.yaml")
}

resource "hcloud_volume_attachment" "podaci" {
  volume_id = hcloud_volume.podaci.id
  server_id = hcloud_server.terminal.id
  automount = true
}
