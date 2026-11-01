'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

const callGetTunnels = rpc.declare({ object: 'luci.cloudflared', method: 'getTunnels', expect: { '': {} } });
const callStartTunnel = rpc.declare({ object: 'luci.cloudflared', method: 'startTunnel', expect: { '': {} } });
const callStopTunnel = rpc.declare({ object: 'luci.cloudflared', method: 'stopTunnel', expect: { '': {} } });
const callRestartTunnel = rpc.declare({ object: 'luci.cloudflared', method: 'restartTunnel', expect: { '': {} } });
const callActivateTunnel = rpc.declare({ object: 'luci.cloudflared', method: 'activateTunnel', params: ['id', 'token'], expect: { '': {} } });
const callCreateTunnel = rpc.declare({ object: 'luci.cloudflared', method: 'createTunnel', params: ['name', 'subdomain', 'service', 'activate'], expect: { '': {} } });
const callAddExistingTunnel = rpc.declare({ object: 'luci.cloudflared', method: 'addExistingTunnel', params: ['name', 'token', 'activate'], expect: { '': {} } });
const callEditTunnel = rpc.declare({ object: 'luci.cloudflared', method: 'editTunnel', params: ['id', 'name', 'warp_routing'], expect: { '': {} } });
const callDeleteTunnel = rpc.declare({ object: 'luci.cloudflared', method: 'deleteTunnel', params: ['id', 'delete_cloud'], expect: { '': {} } });
const callAddIngressRule = rpc.declare({ object: 'luci.cloudflared', method: 'addIngressRule', params: ['tunnel_id', 'hostname', 'service', 'no_tls_verify', 'http_host_header'], expect: { '': {} } });
const callEditIngressRule = rpc.declare({ object: 'luci.cloudflared', method: 'editIngressRule', params: ['tunnel_id', 'old_hostname', 'new_hostname', 'service', 'no_tls_verify', 'http_host_header'], expect: { '': {} } });
const callDeleteIngressRule = rpc.declare({ object: 'luci.cloudflared', method: 'deleteIngressRule', params: ['tunnel_id', 'hostname'], expect: { '': {} } });
const callToggleIngressRule = rpc.declare({ object: 'luci.cloudflared', method: 'toggleIngressRule', params: ['tunnel_id', 'hostname', 'enable'], expect: { '': {} } });
const callGetTunnelLogs = rpc.declare({ object: 'luci.cloudflared', method: 'getTunnelLogs', params: ['lines'], expect: { '': {} } });
const callTestRouteReachability = rpc.declare({ object: 'luci.cloudflared', method: 'testRouteReachability', params: ['hostname', 'service'], expect: { '': {} } });

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return L.resolveDefault(callGetTunnels(), { tunnels: [], service_running: false });
	},

	renderStatusBadge: function(tunnel) {
		if (tunnel.is_running) {
			return E('span', {
				'class': 'badge',
				'style': 'background:#22c55e;color:#fff;padding:4px 12px;border-radius:14px;font-size:12px;font-weight:bold;display:inline-flex;align-items:center;gap:6px;'
			}, [
				E('span', { 'style': 'display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;' }),
				_('Active & Connected') + ' (' + (tunnel.status || 'running') + ')'
			]);
		} else if (tunnel.is_active) {
			return E('span', {
				'class': 'badge',
				'style': 'background:#ef4444;color:#fff;padding:4px 12px;border-radius:14px;font-size:12px;font-weight:bold;'
			}, _('Assigned (Service Stopped)'));
		} else {
			return E('span', {
				'class': 'badge',
				'style': 'background:#64748b;color:#fff;padding:4px 12px;border-radius:14px;font-size:12px;'
			}, _('Inactive / Ready'));
		}
	},

	openLogModal: function() {
		var logBox = E('pre', {
			'style': 'background:#020617;color:#38bdf8;padding:14px;border-radius:6px;max-height:420px;overflow-y:auto;font-family:monospace;font-size:11px;line-height:1.4;'
		}, _('Loading logs...'));

		function refreshLogs() {
			callGetTunnelLogs(100).then(function(res) {
				logBox.textContent = res.logs || _('No logs available.');
				logBox.scrollTop = logBox.scrollHeight;
			}).catch(function(e) {
				logBox.textContent = 'Error: ' + e.message;
			});
		}

		refreshLogs();

		ui.showModal(_('Cloudflare Tunnel Live Service Log'), [
			E('p', { 'style': 'color:#94a3b8;font-size:12px;margin-bottom:8px;' },
				_('Showing latest runtime logs from /var/log/cloudflared.log on router.')),
			logBox,
			E('div', { 'class': 'right', 'style': 'margin-top:15px;' }, [
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': refreshLogs
				}, '🔄 ' + _('Refresh Log')),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'click': ui.hideModal
				}, _('Close'))
			])
		]);
	},

	openEditTunnelModal: function(tunnel) {
		var inputName = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': tunnel.name });
		var chkWarp = E('input', { 'type': 'checkbox', 'checked': tunnel.warp_routing });

		ui.showModal(_('Edit Tunnel Properties') + ' (' + tunnel.name + ')', [
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Tunnel Name')),
				E('div', { 'class': 'cbi-value-field' }, inputName)
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('WARP Private Routing')),
				E('div', { 'class': 'cbi-value-field' }, [
					chkWarp,
					E('label', { 'style': 'margin-left:6px;' }, _('Enable WARP Client Routing to LAN Subnet'))
				])
			]),
			E('div', { 'class': 'right', 'style': 'margin-top:20px;' }, [
				E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-positive',
					'click': function() {
						var n = inputName.value.trim();
						if (!n) return;
						ui.showIndicator();
						callEditTunnel(tunnel.id, n, chkWarp.checked).then(function(res) {
							ui.hideIndicator();
							ui.hideModal();
							if (res && res.success) {
								ui.addNotification(null, E('p', _('Tunnel updated successfully!')), 'info');
								window.location.reload();
							} else {
								ui.addNotification(null, E('p', _('Failed: ') + (res.error || '')), 'danger');
							}
						}).catch(function(e) {
							ui.hideIndicator();
							ui.addNotification(null, E('p', e.message), 'danger');
						});
					}
				}, _('Save Changes'))
			])
		]);
	},

	openCreateModal: function() {
		var self = this;
		var activeTab = 'api';

		var apiTabBtn = E('button', {
			'class': 'cbi-button cbi-button-action',
			'style': 'margin-right:8px;font-weight:bold;',
			'click': function(ev) {
				activeTab = 'api';
				apiForm.style.display = 'block';
				tokenForm.style.display = 'none';
				apiTabBtn.className = 'cbi-button cbi-button-action';
				tokenTabBtn.className = 'cbi-button cbi-button-neutral';
			}
		}, '⚡ ' + _('Create via Cloudflare API'));

		var tokenTabBtn = E('button', {
			'class': 'cbi-button cbi-button-neutral',
			'style': 'font-weight:bold;',
			'click': function(ev) {
				activeTab = 'token';
				apiForm.style.display = 'none';
				tokenForm.style.display = 'block';
				apiTabBtn.className = 'cbi-button cbi-button-neutral';
				tokenTabBtn.className = 'cbi-button cbi-button-action';
			}
		}, '🔑 ' + _('Add by Existing Token'));

		var inputApiName = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': 'e.g. office-tunnel' });
		var inputSubdomain = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': 'e.g. app.example.com (optional)' });
		var inputService = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': 'e.g. http://192.168.1.100:8000' });
		var chkActivateApi = E('input', { 'type': 'checkbox', 'checked': true });

		var apiForm = E('div', { 'style': 'margin-top:15px;' }, [
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Tunnel Name')),
				E('div', { 'class': 'cbi-value-field' }, inputApiName)
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Public Hostname')),
				E('div', { 'class': 'cbi-value-field' }, inputSubdomain)
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Local Target Service')),
				E('div', { 'class': 'cbi-value-field' }, inputService)
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Activate Immediately')),
				E('div', { 'class': 'cbi-value-field' }, [
					chkActivateApi,
					E('label', { 'style': 'margin-left:6px;' }, _('Run this tunnel on router now'))
				])
			])
		]);

		var inputTokenName = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': 'e.g. external-tunnel' });
		var inputTokenVal = E('textarea', { 'class': 'cbi-input-textarea', 'rows': 4, 'placeholder': 'eyJhIjoi...' });
		var chkActivateToken = E('input', { 'type': 'checkbox', 'checked': true });

		var tokenForm = E('div', { 'style': 'margin-top:15px;display:none;' }, [
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Friendly Name')),
				E('div', { 'class': 'cbi-value-field' }, inputTokenName)
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Tunnel Token')),
				E('div', { 'class': 'cbi-value-field' }, inputTokenVal)
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Activate Immediately')),
				E('div', { 'class': 'cbi-value-field' }, [
					chkActivateToken,
					E('label', { 'style': 'margin-left:6px;' }, _('Run this tunnel on router now'))
				])
			])
		]);

		ui.showModal(_('Create / Add Cloudflare Tunnel'), [
			E('p', { 'style': 'color:#64748b;margin-bottom:12px;' },
				_('Create a brand new tunnel registered directly in Cloudflare Zero Trust, or import an existing tunnel token.')),
			E('div', { 'style': 'margin-bottom:15px;' }, [apiTabBtn, tokenTabBtn]),
			apiForm,
			tokenForm,
			E('div', { 'class': 'right', 'style': 'margin-top:20px;' }, [
				E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-positive',
					'click': function(ev) {
						ui.showIndicator();
						if (activeTab === 'api') {
							var name = inputApiName.value.trim();
							if (!name) {
								ui.hideIndicator();
								ui.addNotification(null, E('p', _('Please enter a tunnel name.')), 'danger');
								return;
							}
							callCreateTunnel(name, inputSubdomain.value.trim(), inputService.value.trim(), chkActivateApi.checked)
								.then(function(res) {
									ui.hideIndicator();
									ui.hideModal();
									if (res && res.success) {
										ui.addNotification(null, E('p', _('Tunnel created successfully!') + ' (ID: ' + res.id + ')'), 'info');
										window.location.reload();
									} else {
										ui.addNotification(null, E('p', _('Failed: ') + (res.error || 'Unknown error')), 'danger');
									}
								}).catch(function(e) {
									ui.hideIndicator();
									ui.addNotification(null, E('p', e.message), 'danger');
								});
						} else {
							var tname = inputTokenName.value.trim();
							var tok = inputTokenVal.value.trim();
							if (!tname || !tok) {
								ui.hideIndicator();
								ui.addNotification(null, E('p', _('Name and Token are required.')), 'danger');
								return;
							}
							callAddExistingTunnel(tname, tok, chkActivateToken.checked)
								.then(function(res) {
									ui.hideIndicator();
									ui.hideModal();
									if (res && res.success) {
										ui.addNotification(null, E('p', _('Tunnel imported successfully!')), 'info');
										window.location.reload();
									} else {
										ui.addNotification(null, E('p', _('Failed: ') + (res.error || 'Unknown error')), 'danger');
									}
								}).catch(function(e) {
									ui.hideIndicator();
									ui.addNotification(null, E('p', e.message), 'danger');
								});
						}
					}
				}, _('Save & Deploy'))
			])
		]);
	},

	openRouteModal: function(tunnelId, tunnelName, existingRule) {
		var isEdit = !!existingRule;
		var inputHostname = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'value': isEdit ? existingRule.hostname : '',
			'placeholder': 'e.g. app.example.com'
		});
		var inputTarget = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'value': isEdit ? existingRule.service : '',
			'placeholder': 'e.g. http://192.168.1.100:8000'
		});
		var chkNoTls = E('input', {
			'type': 'checkbox',
			'checked': isEdit && existingRule.originRequest && existingRule.originRequest.noTLSVerify
		});
		var inputHostHeader = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'value': (isEdit && existingRule.originRequest && existingRule.originRequest.httpHostHeader) ? existingRule.originRequest.httpHostHeader : '',
			'placeholder': 'Leave empty for default'
		});

		var modalTitle = isEdit
			? _('Edit Public Route') + ' (' + existingRule.hostname + ')'
			: _('Add Public Route / Hostname') + ' (' + tunnelName + ')';

		ui.showModal(modalTitle, [
			E('p', { 'style': 'color:#64748b;margin-bottom:15px;' },
				_('Map a public domain name to a local router or LAN service. Automatically updates Cloudflare Ingress rules and public CNAME DNS records.')),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Public Hostname')),
				E('div', { 'class': 'cbi-value-field' }, inputHostname)
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Target Local Service')),
				E('div', { 'class': 'cbi-value-field' }, [
					inputTarget,
					E('small', { 'style': 'display:block;color:#94a3b8;margin-top:4px;' },
						_('Example: http://192.168.1.100:8000 or http://192.168.1.1:8088'))
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('No TLS Verify')),
				E('div', { 'class': 'cbi-value-field' }, [
					chkNoTls,
					E('label', { 'style': 'margin-left:6px;' }, _('Ignore self-signed SSL errors (for local HTTPS origins)'))
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('HTTP Host Header (Optional)')),
				E('div', { 'class': 'cbi-value-field' }, inputHostHeader)
			]),
			E('div', { 'class': 'right', 'style': 'margin-top:20px;' }, [
				E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-positive',
					'click': function() {
						var h = inputHostname.value.trim();
						var s = inputTarget.value.trim();
						var noTls = chkNoTls.checked;
						var hostHdr = inputHostHeader.value.trim();
						if (!h || !s) {
							ui.addNotification(null, E('p', _('Hostname and target service are required.')), 'danger');
							return;
						}
						ui.showIndicator();

						var prom = isEdit
							? callEditIngressRule(tunnelId, existingRule.hostname, h, s, noTls, hostHdr)
							: callAddIngressRule(tunnelId, h, s, noTls, hostHdr);

						prom.then(function(res) {
							ui.hideIndicator();
							ui.hideModal();
							if (res && res.success) {
								ui.addNotification(null, E('p', _('Route updated successfully! Cloudflare Ingress & DNS synced.')), 'info');
								window.location.reload();
							} else {
								ui.addNotification(null, E('p', _('Error: ') + (res.error || 'Failed')), 'danger');
							}
						}).catch(function(e) {
							ui.hideIndicator();
							ui.addNotification(null, E('p', e.message), 'danger');
						});
					}
				}, isEdit ? _('Save Changes') : _('Add Route & DNS'))
			])
		]);
	},

	renderTunnelCard: function(tunnel) {
		var self = this;
		var isLocalActive = tunnel.is_active;
		var isRunning = tunnel.is_running;

		// Connections Table
		var conns = tunnel.connections || [];
		var connsContent;
		if (conns.length > 0) {
			connsContent = E('table', { 'class': 'table cbi-section-table', 'style': 'margin-top:8px;font-size:12px;' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Edge Data Center')),
					E('th', { 'class': 'th' }, _('Origin IP')),
					E('th', { 'class': 'th' }, _('Protocol / Client')),
					E('th', { 'class': 'th' }, _('Connected Since'))
				]),
				E(conns.map(function(c, i) {
					var rowClass = i % 2 === 0 ? 'cbi-rowstyle-1' : 'cbi-rowstyle-2';
					var openDate = c.opened_at ? new Date(c.opened_at).toLocaleString() : '-';
					return E('tr', { 'class': 'tr ' + rowClass }, [
						E('td', { 'class': 'td' }, [
							E('b', { 'style': 'color:#3b82f6;' }, c.colo_name || '-'),
							' ',
							E('span', { 'style': 'color:#10b981;font-size:11px;' }, '● ' + _('Connected'))
						]),
						E('td', { 'class': 'td' }, c.origin_ip || '-'),
						E('td', { 'class': 'td' }, (c.protocol || 'QUIC') + (c.client_version ? ' (' + c.client_version + ')' : '')),
						E('td', { 'class': 'td' }, openDate)
					]);
				}))
			]);
		} else {
			connsContent = E('div', { 'style': 'color:#94a3b8;font-size:12px;padding:6px 0;' },
				isRunning ? _('Active connection (waiting for edge reporting)...') : _('No active edge connections'));
		}

		// Ingress Routes Table with Dual Reachability Test (Local + Public) and Toggle Enable/Disable
		var ingress = tunnel.ingress || [];
		var ingressContent;
		if (ingress.length > 0) {
			ingressContent = E('table', { 'class': 'table cbi-section-table', 'style': 'margin-top:8px;font-size:12px;' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Public Hostname')),
					E('th', { 'class': 'th' }, _('Status')),
					E('th', { 'class': 'th' }, _('Target Local Service')),
					E('th', { 'class': 'th' }, _('Reachability Test (Local + Cloudflare Edge)')),
					E('th', { 'class': 'th', 'style': 'text-align:right;' }, _('Actions'))
				]),
				E(ingress.map(function(r, i) {
					var rowClass = i % 2 === 0 ? 'cbi-rowstyle-1' : 'cbi-rowstyle-2';
					var isEnabled = (r.is_enabled !== false);

					var statusBadge = isEnabled
						? E('span', { 'style': 'background:rgba(34,197,94,0.15);border:1px solid #22c55e;color:#22c55e;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;' }, '● ' + _('Enabled'))
						: E('span', { 'style': 'background:rgba(245,158,11,0.15);border:1px solid #f59e0b;color:#f59e0b;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;' }, '⏸️ ' + _('Paused (503)'));

					var testResultContainer = E('div', { 'style': 'display:inline-flex;align-items:center;gap:6px;' }, [
						E('span', { 'style': 'color:#94a3b8;font-size:11px;' }, _('Click test to verify'))
					]);

					var btnTest = E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'style': 'padding:2px 8px;font-size:11px;',
						'click': function() {
							testResultContainer.innerHTML = '<span style="color:#38bdf8;font-size:11px;">⏳ ' + _('Checking Local & Public...') + '</span>';
							callTestRouteReachability(r.hostname, r.service).then(function(t) {
								testResultContainer.innerHTML = '';

								// Local badge
								var locBadge;
								if (t && t.local && t.local.reachable) {
									locBadge = E('span', { 'style': 'color:#22c55e;font-size:11px;font-weight:bold;' }, '🏠 Loc: ' + t.local.status_code + ' (' + t.local.latency_ms + 'ms)');
								} else {
									locBadge = E('span', { 'style': 'color:#ef4444;font-size:11px;font-weight:bold;' }, '🏠 Loc: ' + ((t && t.local && t.local.status_code) || 'FAIL'));
								}

								// Public Cloudflare edge badge
								var pubBadge;
								if (t && t.public && t.public.reachable) {
									var pcode = t.public.status_code;
									var pcolor = '#22c55e';
									var picon = '🌐 CF: ';
									if (pcode === '403') {
										pcolor = '#f59e0b';
										picon = '🛡️ CF WAF: ';
									} else if (pcode === '503') {
										pcolor = '#f59e0b';
										picon = '⏸️ CF 503: ';
									}
									pubBadge = E('span', { 'style': 'color:' + pcolor + ';font-size:11px;font-weight:bold;' }, picon + pcode + ' (' + t.public.latency_ms + 'ms)');
								} else {
									pubBadge = E('span', { 'style': 'color:#ef4444;font-size:11px;font-weight:bold;' }, '🌐 CF: ' + ((t && t.public && t.public.status_code) || 'FAIL'));
								}

								testResultContainer.appendChild(locBadge);
								testResultContainer.appendChild(document.createTextNode(' | '));
								testResultContainer.appendChild(pubBadge);
							}).catch(function(err) {
								testResultContainer.innerHTML = '<span style="color:#ef4444;font-size:11px;">Error: ' + err.message + '</span>';
							});
						}
					}, '⚡ ' + _('Test Pipeline'));

					var extraTags = [];
					if (r.originRequest) {
						if (r.originRequest.noTLSVerify) {
							extraTags.push(E('span', { 'style': 'background:#334155;color:#f59e0b;padding:1px 5px;border-radius:3px;font-size:10px;margin-left:4px;' }, 'NoTLSVerify'));
						}
						if (r.originRequest.httpHostHeader) {
							extraTags.push(E('span', { 'style': 'background:#334155;color:#38bdf8;padding:1px 5px;border-radius:3px;font-size:10px;margin-left:4px;' }, 'Host: ' + r.originRequest.httpHostHeader));
						}
					}

					var btnToggle = E('button', {
						'class': isEnabled ? 'cbi-button cbi-button-neutral' : 'cbi-button cbi-button-positive',
						'style': 'padding:2px 8px;font-size:11px;margin-right:4px;',
						'click': function() {
							var actionWord = isEnabled ? _('temporarily pause') : _('re-enable');
							if (!confirm(_('Do you want to ') + actionWord + ' ' + r.hostname + '?')) return;
							ui.showIndicator();
							callToggleIngressRule(tunnel.id, r.hostname, !isEnabled).then(function(res) {
								ui.hideIndicator();
								if (res && res.success) {
									ui.addNotification(null, E('p', _('Route status updated.')), 'info');
									window.location.reload();
								} else {
									ui.addNotification(null, E('p', _('Failed: ') + (res.error || '')), 'danger');
								}
							}).catch(function(e) {
								ui.hideIndicator();
								ui.addNotification(null, E('p', e.message), 'danger');
							});
						}
					}, isEnabled ? '⏸️ ' + _('Pause') : '▶️ ' + _('Resume'));

					return E('tr', { 'class': 'tr ' + rowClass }, [
						E('td', { 'class': 'td' }, [
							E('a', { 'href': 'https://' + r.hostname, 'target': '_blank', 'style': 'font-weight:bold;color:#38bdf8;' }, r.hostname),
							' ',
							E('a', { 'href': 'https://' + r.hostname, 'target': '_blank', 'style': 'color:#94a3b8;font-size:11px;' }, '↗')
						]),
						E('td', { 'class': 'td' }, statusBadge),
						E('td', { 'class': 'td' }, [
							E('code', { 'style': 'background:#1e293b;padding:3px 7px;border-radius:4px;color:#f8fafc;' }, r.service),
							extraTags
						]),
						E('td', { 'class': 'td' }, [
							btnTest,
							' ',
							testResultContainer
						]),
						E('td', { 'class': 'td', 'style': 'text-align:right;' }, [
							btnToggle,
							E('button', {
								'class': 'cbi-button cbi-button-neutral',
								'style': 'padding:2px 8px;font-size:11px;margin-right:4px;',
								'click': function() {
									self.openRouteModal(tunnel.id, tunnel.name, r);
								}
							}, '✏️ ' + _('Edit')),
							E('button', {
								'class': 'cbi-button cbi-button-negative',
								'style': 'padding:2px 8px;font-size:11px;',
								'click': function() {
									if (!confirm(_('Delete hostname route: ') + r.hostname + '?\n\n' + _('This also deletes the public CNAME DNS record from Cloudflare.'))) return;
									ui.showIndicator();
									callDeleteIngressRule(tunnel.id, r.hostname).then(function(res) {
										ui.hideIndicator();
										if (res && res.success) {
											ui.addNotification(null, E('p', _('Route and DNS deleted.')), 'info');
											window.location.reload();
										} else {
											ui.addNotification(null, E('p', _('Failed: ') + (res.error || '')), 'danger');
										}
									});
								}
							}, '🗑️ ' + _('Delete'))
						])
					]);
				}))
			]);
		} else {
			ingressContent = E('div', { 'style': 'color:#94a3b8;font-size:12px;padding:6px 0;' }, _('No public hostnames configured yet.'));
		}

		// Action buttons
		var actionButtons = [];

		if (!isLocalActive) {
			actionButtons.push(
				E('button', {
					'class': 'cbi-button cbi-button-positive',
					'style': 'margin-right:6px;',
					'click': function() {
						if (!confirm(_('Switch router active tunnel to: ') + tunnel.name + '?')) return;
						ui.showIndicator();
						callActivateTunnel(tunnel.id, tunnel.token).then(function(res) {
							ui.hideIndicator();
							if (res && res.success) {
								ui.addNotification(null, E('p', _('Switched to tunnel: ') + tunnel.name), 'info');
								window.location.reload();
							} else {
								ui.addNotification(null, E('p', _('Failed: ') + (res.error || '')), 'danger');
							}
						});
					}
				}, '▶ ' + _('Activate on this Router'))
			);
		} else {
			if (isRunning) {
				actionButtons.push(
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'style': 'margin-right:6px;',
						'click': function() {
							if (!confirm(_('Stop this tunnel service on router?'))) return;
							ui.showIndicator();
							callStopTunnel().then(function() {
								ui.hideIndicator();
								ui.addNotification(null, E('p', _('Tunnel stopped.')), 'info');
								window.location.reload();
							});
						}
					}, '⏹ ' + _('Stop Service'))
				);
				actionButtons.push(
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'style': 'margin-right:6px;',
						'click': function() {
							ui.showIndicator();
							callRestartTunnel().then(function() {
								ui.hideIndicator();
								ui.addNotification(null, E('p', _('Tunnel service restarted.')), 'info');
								window.location.reload();
							});
						}
					}, '🔄 ' + _('Restart'))
				);
			} else {
				actionButtons.push(
					E('button', {
						'class': 'cbi-button cbi-button-positive',
						'style': 'margin-right:6px;',
						'click': function() {
							ui.showIndicator();
							callStartTunnel().then(function() {
								ui.hideIndicator();
								ui.addNotification(null, E('p', _('Tunnel service started.')), 'info');
								window.location.reload();
							});
						}
					}, '▶ ' + _('Start Service'))
				);
			}
		}

		actionButtons.push(
			E('button', {
				'class': 'cbi-button cbi-button-action',
				'style': 'margin-right:6px;',
				'click': function() {
					self.openRouteModal(tunnel.id, tunnel.name, null);
				}
			}, '➕ ' + _('Add Route / Hostname'))
		);

		actionButtons.push(
			E('button', {
				'class': 'cbi-button cbi-button-neutral',
				'style': 'margin-right:6px;',
				'click': function() {
					self.openEditTunnelModal(tunnel);
				}
			}, '✏️ ' + _('Edit Tunnel'))
		);

		actionButtons.push(
			E('button', {
				'class': 'cbi-button cbi-button-neutral',
				'style': 'margin-right:6px;',
				'click': function() {
					self.openLogModal();
				}
			}, '📜 ' + _('Live Logs'))
		);

		if (tunnel.token) {
			actionButtons.push(
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'style': 'margin-right:6px;',
					'click': function() {
						var tokBox = E('textarea', { 'class': 'cbi-input-textarea', 'rows': 5, 'readonly': true }, tunnel.token);
						ui.showModal(_('Tunnel Token') + ' (' + tunnel.name + ')', [
							E('p', {}, _('Use this token to run this tunnel on any client or device:')),
							tokBox,
							E('div', { 'class': 'right', 'style': 'margin-top:15px;' }, [
								E('button', {
									'class': 'cbi-button cbi-button-action',
									'click': function() {
										tokBox.select();
										navigator.clipboard.writeText(tunnel.token);
										ui.addNotification(null, E('p', _('Token copied to clipboard!')), 'info');
									}
								}, '📋 ' + _('Copy Token')),
								' ',
								E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Close'))
							])
						]);
					}
				}, '🔑 ' + _('Token'))
			);
		}

		actionButtons.push(
			E('button', {
				'class': 'cbi-button cbi-button-negative',
				'click': function() {
					var delCloud = confirm(_('Delete tunnel: ') + tunnel.name + '?\n\n' + _('Click OK to delete. (Also removes from Cloudflare Zero Trust account)'));
					if (!delCloud) return;
					ui.showIndicator();
					callDeleteTunnel(tunnel.id, true).then(function(res) {
						ui.hideIndicator();
						if (res && res.success) {
							ui.addNotification(null, E('p', _('Tunnel deleted.')), 'info');
							window.location.reload();
						} else {
							ui.addNotification(null, E('p', _('Failed: ') + (res.error || '')), 'danger');
						}
					});
				}
			}, '🗑 ' + _('Delete'))
		);

		var borderStyle = isLocalActive
			? 'border: 2px solid #22c55e; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.15);'
			: 'border: 1px solid #334155;';

		return E('div', {
			'class': 'cbi-section',
			'style': 'background:#0f172a;border-radius:10px;padding:18px;margin-bottom:24px;' + borderStyle
		}, [
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;' }, [
				E('div', { 'style': 'display:flex;align-items:center;gap:12px;' }, [
					E('h3', { 'style': 'margin:0;font-size:18px;color:#f8fafc;' }, [
						tunnel.name,
						isLocalActive ? E('span', { 'style': 'color:#22c55e;font-size:13px;margin-left:8px;font-weight:normal;' }, '★ ' + _('Active Router Tunnel')) : ''
					])
				]),
				self.renderStatusBadge(tunnel)
			]),

			E('div', { 'style': 'display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;background:#1e293b;padding:12px;border-radius:8px;margin-bottom:15px;font-size:13px;' }, [
				E('div', {}, [
					E('span', { 'style': 'color:#94a3b8;' }, _('Tunnel ID: ')),
					E('code', { 'style': 'color:#38bdf8;font-size:11px;' }, tunnel.id)
				]),
				E('div', {}, [
					E('span', { 'style': 'color:#94a3b8;' }, _('Management: ')),
					E('b', { 'style': 'color:#f8fafc;' }, tunnel.token ? _('Zero Trust Token') : _('Cloudflare API'))
				]),
				E('div', {}, [
					E('span', { 'style': 'color:#94a3b8;' }, _('Created At: ')),
					E('span', { 'style': 'color:#cbd5e1;' }, tunnel.created_at ? new Date(tunnel.created_at).toLocaleDateString() : '-')
				]),
				E('div', {}, [
					E('span', { 'style': 'color:#94a3b8;' }, _('WARP Routing: ')),
					E('b', { 'style': tunnel.warp_routing ? 'color:#10b981;' : 'color:#94a3b8;' }, tunnel.warp_routing ? _('Enabled (LAN Subnet)') : _('Disabled'))
				])
			]),

			E('div', { 'style': 'margin-bottom:15px;' }, [
				E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;' }, [
					E('h4', { 'style': 'margin:0;font-size:14px;color:#38bdf8;' }, '🌐 ' + _('Public Ingress Routes & Domains')),
					E('span', { 'style': 'font-size:12px;color:#94a3b8;' }, ingress.length + ' ' + _('routes'))
				]),
				ingressContent
			]),

			E('div', { 'style': 'margin-bottom:18px;' }, [
				E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;' }, [
					E('h4', { 'style': 'margin:0;font-size:14px;color:#10b981;' }, '⚡ ' + _('Cloudflare Edge Connections')),
					E('span', { 'style': 'font-size:12px;color:#94a3b8;' }, conns.length + ' ' + _('active connections'))
				]),
				connsContent
			]),

			E('div', { 'style': 'border-top:1px solid #334155;padding-top:14px;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;' }, actionButtons)
		]);
	},

	render: function(data) {
		var self = this;
		var tunnels = data.tunnels || [];
		var serviceRunning = data.service_running;

		var headerBanner = E('div', {
			'style': 'background:#1e293b;padding:16px 20px;border-radius:10px;margin-bottom:25px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;'
		}, [
			E('div', {}, [
				E('h2', { 'style': 'margin:0 0 5px 0;color:#f8fafc;' }, _('Cloudflare Tunnels Management')),
				E('div', { 'style': 'color:#94a3b8;font-size:13px;' }, [
					_('Active Service: '),
					serviceRunning
						? E('b', { 'style': 'color:#22c55e;' }, '● ' + _('Running & Connected to Cloudflare Edge'))
						: E('b', { 'style': 'color:#ef4444;' }, '○ ' + _('Stopped')),
					' | ',
					_('Managed Tunnels: '),
					E('b', { 'style': 'color:#38bdf8;' }, tunnels.length)
				])
			]),
			E('div', { 'style': 'display:flex;gap:10px;' }, [
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': function() {
						ui.showIndicator();
						window.location.reload();
					}
				}, '🔄 ' + _('Refresh')),
				E('button', {
					'class': 'cbi-button cbi-button-positive',
					'style': 'font-weight:bold;padding:6px 16px;',
					'click': function() {
						self.openCreateModal();
					}
				}, '➕ ' + _('Create / Add New Tunnel'))
			])
		]);

		var tunnelsList;
		if (tunnels.length > 0) {
			tunnelsList = tunnels.map(function(t) {
				return self.renderTunnelCard(t);
			});
		} else {
			tunnelsList = [
				E('div', { 'class': 'cbi-section center', 'style': 'padding:40px;background:#0f172a;border-radius:10px;' }, [
					E('h3', { 'style': 'color:#cbd5e1;margin-bottom:10px;' }, _('No active tunnels found')),
					E('p', { 'style': 'color:#64748b;margin-bottom:20px;' },
						_('Click the button below to create a new tunnel via Cloudflare Zero Trust or import an existing token.')),
					E('button', {
						'class': 'cbi-button cbi-button-positive',
						'click': function() {
							self.openCreateModal();
						}
					}, '➕ ' + _('Create Your First Tunnel'))
				])
			];
		}

		return E('div', { 'class': 'cbi-map' }, [
			headerBanner,
			E('div', {}, tunnelsList)
		]);
	}
});
