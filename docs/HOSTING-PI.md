# ScreenGrid — Hosting the Auth.Server on a Raspberry Pi 3

> Status: **proposal** — hardware and OS decisions below are agreed; the Pi is not
> provisioned yet. See [`AUTH-SERVER.md`](AUTH-SERVER.md) for what the service does
> and [`RELIABILITY.md`](RELIABILITY.md) for its resource budget.

## 1. Target

A headless **control plane** on hardware you own. No media ever flows through it.

| Resource    | Budget                                                  |
| ----------- | ------------------------------------------------------- |
| RAM         | ~120–200 MB RSS, hard-capped at `MemoryMax=300M`        |
| CPU         | near-idle (directory lookups, Ed25519 signing, GeoIP)   |
| Disk writes | well under 1 MB/day of real data                        |

Because the write volume is tiny, **endurance is not the main storage concern —
power-loss safety and keeping data off the boot card are.**

## 2. Hardware

| Item           | Note                                                             |
| -------------- | ---------------------------------------------------------------- |
| Raspberry Pi 3 B / 3 B+ | Cortex-A53 (ARMv8-A, **64-bit capable**), 1 GB RAM      |
| Power supply   | Official 5.1 V / 2.5 A. The Pi 3's USB ports share ~1.2 A total  |
| USB storage    | External HDD or SSD for the database + backups (see §4)          |
| Network        | Ethernet preferred; Pi 3 B is 100 Mbit, 3 B+ is 300 Mbit         |

> ⚠️ **Bus-powered 2.5" HDDs are the classic Pi 3 brown-out.** A 2.5" drive can
> draw 0.5–1 A at spin-up, which together with Wi-Fi can exceed the USB budget and
> reboot the Pi under load. Use a **powered USB hub**, a **self-powered enclosure**,
> or an SSD (much lower peak current).

## 3. Operating system

**Raspberry Pi OS Lite (64-bit), based on Debian 13 "Trixie".**

* **64-bit (`arm64`)** — the Cortex-A53 is a 64-bit core; `arm64` is .NET's primary
  ARM target and **Native AOT is first-class** on it. 32-bit (`armhf`) is the wrong base.
* **Lite** — no desktop; saves 200–400 MB RAM on a 1 GB machine. The service is headless.
* **Trixie = Debian 13** — the only Debian release in .NET 10's *officially
  supported* matrix. Debian 12 "Bookworm" still runs (glibc 2.36 > the required
  2.27) but is no longer tested or supported by Microsoft for .NET 10.

> **Do not pick an arbitrary Linux.** The Pi 3 is ARM, so the image must be
> **`arm64`**. Desktop-oriented x86 distributions publish no ARM build at all and
> simply cannot be installed here — *Linux Lite*, for example, is a desktop distro
> for old PCs, not a Raspberry Pi system. Check that a distribution ships an
> `arm64` image before considering it.

Alternatives, if you would rather not use Raspberry Pi OS:

| Option                          | Note                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Debian 13 `arm64`** (netinst) | Same base, without the Raspberry Pi tooling. Everything in §5 must be done by hand.                                             |
| **Ubuntu Server LTS `arm64`**   | Officially supported by .NET 10, but the Pi 3 is **not** on Canonical's certified list (only Pi 4B / 400 / CM4 / 5 / Zero 2 W) and it is heavier on 1 GB of RAM. |

Confirm the architecture:

```bash
uname -m                      # must print aarch64
dpkg --print-architecture     # must print arm64
```

### Flashing (headless, no monitor needed)

In **Raspberry Pi Imager** choose *Raspberry Pi OS (other) → Raspberry Pi OS Lite
(64-bit)*, then open **Advanced options (⚙)** *before* writing:

- [ ] hostname — e.g. `screengrid-auth`
- [ ] user + strong password
- [ ] **SSH enabled**, with your public key
- [ ] Wi-Fi SSID / password / country (or use Ethernet)
- [ ] locale, keyboard layout, **timezone `Europe/Copenhagen`**

> The Pi 3 has **no real-time clock**. TOTP codes and session-grant TTLs both depend
> on accurate time, so NTP must succeed at boot.

## 4. Storage layout

| Mount              | Device     | Contents                              |
| ------------------ | ---------- | ------------------------------------- |
| `/`                | SD card    | OS + boot only                        |
| `/mnt/screengrid`  | USB disk   | SQLite DB, WAL, backups, logs         |

Why not run everything off the SD card:

* **Separation** — a corrupted boot card does not take the database with it, and you
  can re-flash the OS freely.
* **Power-loss safety** — SD cards have no power-loss protection; an abrupt power cut
  is the most common way a Pi loses its filesystem. A disk is far more predictable.
* **Endurance** — SD NAND has a limited write budget; a magnetic disk effectively
  does not wear out from writes.

Caveats to expect from a USB HDD:

* **Spin-down.** Many drives park after idle, making the next access cost seconds.
  Disable APM if the drive allows it: `sudo hdparm -B 255 -S 0 /dev/sda`.
* **Random I/O is slow** (mechanical seeks). Irrelevant here — our access pattern is
  small and sparse.
* **USB 2.0** on the Pi 3 caps out around 25–35 MB/s. Plenty.

`/etc/fstab` entry — note **`nofail`**, so a missing disk cannot block boot:

```
UUID=<uuid>  /mnt/screengrid  ext4  defaults,noatime,nofail  0  2
```

```bash
sudo mkdir -p /mnt/screengrid/{db,backups}
sudo chown -R screengrid:screengrid /mnt/screengrid
```

## 5. Base system

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y ufw unattended-upgrades sqlite3 hdparm
sudo raspi-config nonint do_hostname screengrid-auth
```

* **Time:** `timedatectl` — confirm `System clock synchronized: yes`.
* **Address:** reserve a static IP (or a DHCP reservation) in your router. A moving
  address breaks every peer that resolved this device.
* **Firewall:** deny inbound by default; expose only what §8 requires.
* **SSH:** key-only, `PasswordAuthentication no`.
* **Swap:** keep `vm.swappiness` low. Raspberry Pi OS enables `zram` by default,
  which is exactly what you want on 1 GB of RAM.

## 6. Deploying the service

Publish **on the Windows dev machine** — the .NET SDK never has to be installed on
the Pi:

```powershell
dotnet publish src/ScreenGrid.Auth.Server -c Release -r linux-arm64 --self-contained true
```

Copy the output to `/opt/screengrid-auth/` and run it as a dedicated non-root user.

`/etc/systemd/system/screengrid-auth.service`:

```ini
[Unit]
Description=ScreenGrid Auth Server
After=network-online.target
Wants=network-online.target
# never start before the data disk is mounted
RequiresMountsFor=/mnt/screengrid

[Service]
User=screengrid
WorkingDirectory=/opt/screengrid-auth
ExecStart=/opt/screengrid-auth/ScreenGrid.Auth.Server
Restart=on-failure
RestartSec=3
MemoryMax=300M
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/mnt/screengrid

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now screengrid-auth
```

## 7. SQLite

* Store the database at `/mnt/screengrid/db/auth.db` in **WAL mode**.
* Back up nightly with the online-backup command (safe while the service runs):

```bash
sqlite3 /mnt/screengrid/db/auth.db \
  ".backup /mnt/screengrid/backups/auth-$(date +%F).db"
```

Drive it from a `systemd` timer, and check integrity periodically:

```bash
sqlite3 /mnt/screengrid/db/auth.db "PRAGMA integrity_check;"
```

> One USB disk is still a single point of failure. Copy a backup **off the device**
> (your PC or another machine) at least weekly.

## 8. Remote access — OPEN DECISION

How the Pi is reached from the internet is still undecided
([`AUTH-SERVER.md`](AUTH-SERVER.md) §12, [`PROTOCOL.md`](PROTOCOL.md) §8 D2):

| Option                                          | Trade-off                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Reverse tunnel (**Tailscale / Cloudflare Tunnel**) | No open ports, works behind CGNAT; adds a third party (or self-hosted control plane) |
| Port-forward + Let's Encrypt                    | Fully self-hosted; exposes the Pi directly, needs a public/static IP, blocked by CGNAT |

`PROTOCOL.md` §8 D2 leans towards a **tunnel for v1**, because the same choice also
carries the v1 media path. Record the decision here once it is made.

## 9. Operations

* **Logs:** `journalctl -u screengrid-auth -f`.
* **Memory watchdog:** if the service approaches 300 MB something is wrong — media
  must never flow through this process.
* **Updates:** publish a new build, replace `/opt/screengrid-auth`, then
  `systemctl restart`. Keep the previous output until the new one has survived a day.
* **Power:** use a quality PSU (ideally a small UPS). The Pi has no clean-shutdown button.

## 10. Provisioning checklist

- [ ] 64-bit Raspberry Pi OS Lite (Trixie) flashed — `uname -m` prints `aarch64`
- [ ] SSH key-only login works; password auth disabled
- [ ] Hostname, timezone and NTP confirmed (`timedatectl`)
- [ ] USB disk mounted with `noatime,nofail`; survives a reboot with the disk unplugged
- [ ] Dedicated `screengrid` user owns `/mnt/screengrid`
- [ ] systemd unit installed, `MemoryMax=300M`, starts only after the mount
- [ ] Nightly SQLite backup timer runs; one backup has been copied off-device
- [ ] Firewall default-deny; only the required port or tunnel is reachable
- [ ] Remote-access decision recorded in §8
