output "ip_adresa" {
  description = "Adresa servera — na nju se usmeravaju domeni i preko nje se ulazi SSH-om."
  value       = hcloud_server.terminal.ipv4_address
}

output "mesecni_trosak_priblizno_eur" {
  description = "Gruba procena, da se trosak vidi pre nego sto se isporuci (`tofu plan`), ne tek na racunu."
  value = format(
    "server ~%s + disk %s GB ~%.2f + kopije servera ~%s = ukupno priblizno",
    var.tip_servera, var.velicina_diska_gb, var.velicina_diska_gb * 0.0572, "20% cene servera"
  )
}
