# FreeSWITCH config templates for TGV Front Desk

These XML files template the subset of FreeSWITCH configuration the Front Desk
module depends on. They're rendered in-place over `/etc/freeswitch/…` by
`/srv/refusion-core/utils/scripts/telephony/render-freeswitch-config.sh`,
which `envsubst`s the `${VAR}` placeholders against `.env.local` + an optional
`/etc/freeswitch/tgv.env` overlay.

## Files

| Template                                   | Destination                                          |
|--------------------------------------------|-------------------------------------------------------|
| `sip_profiles/external-telnyx.xml.tmpl`    | `/etc/freeswitch/sip_profiles/external/telnyx.xml`   |
| `sip_profiles/internal-webrtc.xml.tmpl`    | `/etc/freeswitch/sip_profiles/internal/webrtc.xml`   |
| `dialplan/frontdesk.xml.tmpl`              | `/etc/freeswitch/dialplan/frontdesk.xml`             |
| `dialplan/outbound.xml.tmpl`               | `/etc/freeswitch/dialplan/outbound.xml`              |
| `event_socket.conf.xml.tmpl`               | `/etc/freeswitch/autoload_configs/event_socket.conf.xml` |

## Required env vars

| Variable                      | Purpose                                                   |
|-------------------------------|-----------------------------------------------------------|
| `TELNYX_SIP_USERNAME`         | Telnyx SIP credential username                            |
| `TELNYX_SIP_PASSWORD`         | Telnyx SIP credential password                            |
| `TELNYX_SIP_REGISTRAR`        | Typically `sip.telnyx.com`                                |
| `FRONTDESK_ESL_PASSWORD`      | Password the Node ESL bridge uses to connect to port 8021 |
| `FRONTDESK_PUBLIC_HOSTNAME`   | Public DNS for WSS softphone (e.g. `office.tinyglobalvillage.com`) |
| `FRONTDESK_CALLER_ID_E164`    | Default outbound caller ID presented to Telnyx            |

## Install order (one-time per host)

```bash
sudo /srv/refusion-core/utils/scripts/telephony/install-freeswitch.sh
sudo /srv/refusion-core/utils/scripts/telephony/render-freeswitch-config.sh
sudo systemctl status freeswitch
```

## Consent notice audio

Drop a 44.1kHz mono WAV at `/var/lib/freeswitch/prompts/consent-notice.wav`
with the disclosure you want to play at call pickup. The path is referenced
in `dialplan/frontdesk.xml.tmpl`.

## WebRTC TLS

`internal-webrtc.xml.tmpl` expects certs in `/etc/freeswitch/tls/wss.pem`. The
simplest path is a `certbot --standalone` run against the public hostname and
a systemd renewal hook that `cat`s `fullchain.pem` + `privkey.pem` into that
file and reloads FreeSWITCH.
