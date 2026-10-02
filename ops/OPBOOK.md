# ops 应急手册

按场景照顺序敲命令。每个命令都有 `--help`。

## 先解锁

```sh
ops-unlock        # 输 vault 口令，提示符变 (unlocked)
ops-paste         # vault 不能用时，手动粘贴 token
```

`exit` 锁回。空闲 15 分钟自动锁。

## IP 被封

```sh
ops-move-ip                  # 看现状
ops-new-ip <droplet>         # 换 IPv4；IPv6 用 ops-new-ip -6 <droplet>
```

按提示：确认换 IP，确认改 DNS，释放旧 IP 选 n。
新 IP 能连通后，再删旧 IP：

```sh
doctl compute reserved-ip delete <old-ip>      # IPv6：reserved-ipv6
```

订阅链接里写死的 IP 要手动改。

## DNS 没跟着改

```sh
ops-dns <old-ip>             # 看哪些记录指向它
ops-dns <old-ip> <new-ip>    # 改过去
```

## 换到一半失败

不要重跑 `ops-new-ip`。按它打印的补救命令做，没看到就：

```sh
ops-move-ip                  # 找没绑定的新地址
ops-move-ip <new-ip> <droplet>
```

报 `pending event` 或 `404`：等半分钟再执行。

## IP 挪到另一台 droplet

```sh
ops-move-ip                  # 看现状
ops-move-ip <ip> <droplet>
```

目标要在同一 region，且没有同类型的 reserved IP。

## droplet 无响应

```sh
doctl compute droplet list
doctl compute droplet-action reboot <id>
doctl compute droplet-action power-cycle <id>   # reboot 无效时
```

还不行：DigitalOcean 网页控制台的 Recovery Console。

## 断线

登录自动进入 tmux 会话 `ops`，断线后命令继续跑，重新登录回到原处。
滚动用鼠标滚轮。离开前先 `exit` 锁回。
