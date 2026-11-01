# SPDX-License-Identifier: GPL-3.0-only
#
# Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for Cloudflared
LUCI_DEPENDS:=+cloudflared +ucode +ucode-mod-fs +ucode-mod-uci +curl
LUCI_PKGARCH:=all
LUCI_DESCRIPTION:=LuCI support for Cloudflared Zero Trust Tunnels

PKG_MAINTAINER:=Hilman Maulana <hilman0.0maulana@gmail.com>
PKG_NAME:=luci-app-cloudflared
PKG_VERSION:=2.1.0

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
