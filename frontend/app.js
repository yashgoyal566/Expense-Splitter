(function () {
  'use strict';

  const STORAGE_KEY = 'quicksplit_app_v9';
  const PROCESSED_ORDERS_KEY = 'quicksplit_processed_orders';
  const BACKEND_URL = 'http://localhost:5000';

  let cashfree = null;

  let state = {
    participants: [],
    expenses: []
  };

  let formSelectedParticipants = [];

  const el = {
    groupMemberCountBadge: document.getElementById('groupMemberCountBadge'),
    formAddParticipant: document.getElementById('formAddParticipant'),
    inputParticipantName: document.getElementById('inputParticipantName'),
    participantsList: document.getElementById('participantsList'),

    minParticipantsNotice: document.getElementById('minParticipantsNotice'),
    formExpense: document.getElementById('formExpense'),
    expenseAmount: document.getElementById('expenseAmount'),
    expensePayer: document.getElementById('expensePayer'),
    participantChipsContainer: document.getElementById('participantChipsContainer'),
    btnSelectAll: document.getElementById('btnSelectAll'),
    btnClearAll: document.getElementById('btnClearAll'),
    splitLivePreview: document.getElementById('splitLivePreview'),
    btnSubmitExpense: document.getElementById('btnSubmitExpense'),

    statTotal: document.getElementById('statTotal'),
    statCount: document.getElementById('statCount'),
    debtsList: document.getElementById('debtsList'),
    settledBanner: document.getElementById('settledBanner'),
    historyList: document.getElementById('historyList'),
    emptyHistory: document.getElementById('emptyHistory'),
    btnReset: document.getElementById('btnReset'),

    paymentBanner: document.getElementById('paymentBanner'),
    paymentBannerIcon: document.getElementById('paymentBannerIcon'),
    paymentBannerText: document.getElementById('paymentBannerText'),
    btnCloseBanner: document.getElementById('btnCloseBanner'),

    participantWarning: document.getElementById('participantWarning'),
    participantWarningText: document.getElementById('participantWarningText'),
    btnCloseParticipantWarning: document.getElementById('btnCloseParticipantWarning')
  };

  const tmpl = {
    badge: document.getElementById('tmplParticipantBadge'),
    chip: document.getElementById('tmplChip'),
    debt: document.getElementById('tmplDebt'),
    history: document.getElementById('tmplHistory'),
    option: document.getElementById('tmplOption')
  };

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.participants)) state.participants = parsed.participants;
        if (Array.isArray(parsed.expenses)) state.expenses = parsed.expenses;
      }
    } catch (e) {
      console.error(e);
    }

    syncFormParticipantsWithGroup();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error(e);
    }
  }

  function syncFormParticipantsWithGroup() {
    formSelectedParticipants = [...state.participants];
  }

  function calculateBalances() {
    const allMembers = [...state.participants];
    state.expenses.forEach(e => {
      if (e.payer && !allMembers.includes(e.payer)) allMembers.push(e.payer);
      if (Array.isArray(e.participants)) {
        e.participants.forEach(p => {
          if (!allMembers.includes(p)) allMembers.push(p);
        });
      }
    });

    

    const ledger = {};
    allMembers.forEach(a => {
      ledger[a] = {};
      allMembers.forEach(b => {
        ledger[a][b] = 0;
      });
    });

    state.expenses.forEach(e => {
      const payer = e.payer;
      const parts = Array.isArray(e.participants) && e.participants.length > 0
        ? e.participants
        : [payer];

      const share = Number(e.amount) / parts.length;
      parts.forEach(member => {
        if (member !== payer && ledger[payer] && ledger[payer][member] !== undefined) {
          ledger[payer][member] += share;
        }
      });
    });

    const debts = [];

    for (let i = 0; i < allMembers.length; i++) {
      for (let j = i + 1; j < allMembers.length; j++) {
        const memA = allMembers[i];
        const memB = allMembers[j];

        const aPaidForB = ledger[memA][memB] || 0;
        const bPaidForA = ledger[memB][memA] || 0;
        const net = Math.round((aPaidForB - bPaidForA) * 100) / 100;

        if (net > 0.009) {
          debts.push({ from: memB, to: memA, amount: net });
        } else if (net < -0.009) {
          debts.push({ from: memA, to: memB, amount: Math.abs(net) });
        }
      }
    }

    const total = state.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    return { total, debts };
  }

  function render() {
    const memberCount = state.participants.length;
    el.groupMemberCountBadge.textContent = `${memberCount} ${memberCount === 1 ? 'Member' : 'Members'}`;

    const canSplit = memberCount >= 2;
    el.minParticipantsNotice.classList.toggle('hidden', canSplit);
    el.formExpense.classList.toggle('disabled', !canSplit);
    el.expenseAmount.disabled = !canSplit;
    el.expensePayer.disabled = !canSplit;
    el.btnSelectAll.disabled = !canSplit;
    el.btnClearAll.disabled = !canSplit;
    el.btnSubmitExpense.disabled = !canSplit;

    renderParticipantBadges();
    renderPayerDropdown();
    renderParticipantChips();
    updateLivePreview();
    renderDebtsAndHistory();
  }

  function renderParticipantBadges() {
    el.participantsList.replaceChildren();

    state.participants.forEach(name => {
      const clone = tmpl.badge.content.cloneNode(true);
      const nameEl = clone.querySelector('.member-name');
      const removeBtn = clone.querySelector('.btn-remove-member');

      nameEl.textContent = name;
      removeBtn.addEventListener('click', () => {
        removeParticipant(name);
      });

      el.participantsList.appendChild(clone);
    });
  }

  function renderPayerDropdown() {
    const selected = el.expensePayer.value;
    el.expensePayer.replaceChildren();

    state.participants.forEach(name => {
      const clone = tmpl.option.content.cloneNode(true);
      const opt = clone.querySelector('option');
      opt.value = name;
      opt.textContent = name;
      if (name === selected) opt.selected = true;
      el.expensePayer.appendChild(opt);
    });
  }

  function renderParticipantChips() {
    el.participantChipsContainer.replaceChildren();

    state.participants.forEach(name => {
      const isSelected = formSelectedParticipants.includes(name);
      const clone = tmpl.chip.content.cloneNode(true);
      const chip = clone.querySelector('.person-chip');
      const icon = chip.querySelector('.chip-icon');
      const label = chip.querySelector('.chip-label');

      icon.textContent = isSelected ? '✓' : '+';
      label.textContent = name;

      if (isSelected) {
        chip.classList.add('selected');
      }

      chip.addEventListener('click', () => {
        toggleParticipant(name);
      });

      el.participantChipsContainer.appendChild(chip);
    });
  }

  function renderDebtsAndHistory() {
    const { total, debts } = calculateBalances();

    el.statTotal.textContent = `₹${total.toFixed(2)}`;
    el.statCount.textContent = state.expenses.length.toString();

    el.debtsList.replaceChildren();
    const hasDebts = debts.length > 0;
    el.settledBanner.classList.toggle('hidden', hasDebts);

    if (hasDebts) {
      debts.forEach(d => {
        const clone = tmpl.debt.content.cloneNode(true);
        clone.querySelector('.debtor').textContent = d.from;
        clone.querySelector('.creditor').textContent = d.to;
        clone.querySelector('.debt-amount').textContent = `₹${d.amount.toFixed(2)}`;

        const payBtn = clone.querySelector('.btn-pay-cashfree');
        if (payBtn) {
          payBtn.textContent = `Pay ₹${d.amount.toFixed(2)}`;
          payBtn.addEventListener('click', () => {
            payWithCashfree(d, payBtn);
          });
        }

        el.debtsList.appendChild(clone);
      });
    }

    el.historyList.replaceChildren();
    const hasHistory = state.expenses.length > 0;
    el.emptyHistory.classList.toggle('hidden', hasHistory);

    if (hasHistory) {
      [...state.expenses].reverse().forEach(exp => {
        const isSettlement = exp.isSettlement === true;
        const partsText = isSettlement
          ? `Settlement to ${exp.participants.join(', ')} via Cashfree`
          : (Array.isArray(exp.participants) && exp.participants.length > 0
            ? `Split among: ${exp.participants.join(', ')}`
            : 'Split among all');

        const clone = tmpl.history.content.cloneNode(true);
        clone.querySelector('.history-title').textContent = isSettlement ? `Settled by ${exp.payer}` : `Paid by ${exp.payer}`;
        clone.querySelector('.history-sub').textContent = partsText;
        clone.querySelector('.history-amount').textContent = `₹${Number(exp.amount).toFixed(2)}`;
        el.historyList.appendChild(clone);
      });
    }
  }

  async function payWithCashfree(debt, buttonEl) {
    if (!cashfree) {
      if (typeof window.Cashfree !== 'undefined') {
        cashfree = window.Cashfree({ mode: 'sandbox' });
      } else {
        alert('Cashfree SDK is not loaded. Please verify your internet connection.');
        return;
      }
    }

    const originalText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = 'Preparing...';

    try {
      const response = await fetch(`${BACKEND_URL}/api/cashfree/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: debt.amount,
          from: debt.from,
          to: debt.to,
          returnOrigin: window.location.origin,
          returnPath: window.location.pathname
        })
      });

      const data = await response.json();
      if (!response.ok || !data.payment_session_id) {
        throw new Error(data.message || data.error || 'Failed to create payment session');
      }

      buttonEl.textContent = 'Redirecting...';
      cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: '_self'
      });
    } catch (err) {
      alert(`Payment initialization failed: ${err.message}`);
      buttonEl.disabled = false;
      buttonEl.textContent = originalText;
    }
  }

  async function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    const orderStatus = urlParams.get('order_status');
    const from = urlParams.get('from');
    const to = urlParams.get('to');
    const amount = parseFloat(urlParams.get('amount'));

    if (!orderId) return;

    let processedOrders = [];
    try {
      const saved = localStorage.getItem(PROCESSED_ORDERS_KEY);
      if (saved) processedOrders = JSON.parse(saved);
    } catch (e) {
      processedOrders = [];
    }

    if (processedOrders.includes(orderId)) {
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    try {
      const verifyRes = await fetch(`${BACKEND_URL}/api/cashfree/verify-order/${orderId}`);
      const verifyData = await verifyRes.json();
      const finalStatus = verifyData.order_status || orderStatus;

      if (finalStatus === 'PAID') {
        if (from && to && !isNaN(amount) && amount > 0) {
          state.expenses.push({
            id: `settle_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            amount: amount,
            payer: from,
            participants: [to],
            isSettlement: true
          });

          processedOrders.push(orderId);
          localStorage.setItem(PROCESSED_ORDERS_KEY, JSON.stringify(processedOrders));
          saveState();
          render();

          showPaymentBanner('success', '✓', `Payment of ₹${amount.toFixed(2)} from ${from} to ${to} completed! Debt settled.`);
        }
      } else {
        showPaymentBanner('error', '⚠️', `Payment was ${finalStatus || 'not completed'}. Debt remains active.`);
      }
    } catch (err) {
      showPaymentBanner('error', '⚠️', `Could not verify payment: ${err.message}`);
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }

  let paymentBannerTimeout = null;

  function showPaymentBanner(type, icon, message) {
    if (!el.paymentBanner) return;
    el.paymentBanner.className = `payment-banner ${type}`;
    el.paymentBannerIcon.textContent = icon;
    el.paymentBannerText.textContent = message;

    clearTimeout(paymentBannerTimeout);
    paymentBannerTimeout = setTimeout(() => {
      el.paymentBanner.classList.add('hidden');
    }, 6000);
  }

  if (el.btnCloseBanner) {
    el.btnCloseBanner.addEventListener('click', () => {
      clearTimeout(paymentBannerTimeout);
      el.paymentBanner.classList.add('hidden');
    });
  }

  let participantNoticeTimeout = null;

  function showParticipantNotice(message) {
    if (!el.participantWarning) return;
    el.participantWarningText.textContent = message;
    el.participantWarning.classList.remove('hidden');

    clearTimeout(participantNoticeTimeout);
    participantNoticeTimeout = setTimeout(() => {
      el.participantWarning.classList.add('hidden');
    }, 6000);
  }

  if (el.btnCloseParticipantWarning) {
    el.btnCloseParticipantWarning.addEventListener('click', () => {
      el.participantWarning.classList.add('hidden');
    });
  }

  function toggleParticipant(name) {
    if (formSelectedParticipants.includes(name)) {
      if (formSelectedParticipants.length > 1) {
        formSelectedParticipants = formSelectedParticipants.filter(p => p !== name);
      }
    } else {
      formSelectedParticipants.push(name);
    }
    renderParticipantChips();
    updateLivePreview();
  }

  function updateLivePreview() {
    const amount = parseFloat(el.expenseAmount.value) || 0;
    const selectedCount = formSelectedParticipants.length;

    if (state.participants.length < 2) {
      el.splitLivePreview.className = 'split-live-preview warning';
      el.splitLivePreview.textContent = 'Add at least 2 participants above';
      return;
    }

    if (selectedCount === 0) {
      el.splitLivePreview.className = 'split-live-preview warning';
      el.splitLivePreview.textContent = '⚠️ Select at least 1 person to split';
    } else {
      el.splitLivePreview.className = 'split-live-preview';
      const perPerson = amount / selectedCount;
      el.splitLivePreview.textContent = `✓ ${selectedCount} of ${state.participants.length} people selected • ₹${perPerson.toFixed(2)} each`;
    }
  }

  el.formAddParticipant.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = el.inputParticipantName.value.trim();
    if (!name) return;

    const exists = state.participants.some(p => p.toLowerCase() === name.toLowerCase());
    if (exists) {
      alert(`"${name}" is already in the group.`);
      return;
    }

    if (el.participantWarning) {
      el.participantWarning.classList.add('hidden');
    }

    state.participants.push(name);
    if (!formSelectedParticipants.includes(name)) {
      formSelectedParticipants.push(name);
    }

    el.inputParticipantName.value = '';
    saveState();
    render();
    el.inputParticipantName.focus();
  });

  function removeParticipant(name) {
    const { debts } = calculateBalances();
    const activeDebts = debts.filter(d => d.from === name || d.to === name);

    if (activeDebts.length > 0) {
      const owes = activeDebts.filter(d => d.from === name);
      const isOwed = activeDebts.filter(d => d.to === name);

      if (owes.length > 0) {
        const totalOwed = owes.reduce((sum, d) => sum + d.amount, 0);
        showParticipantNotice(`Cannot remove this person. They have unsettled debts.`);
        return;
      }

      if (isOwed.length > 0) {
        const totalOwedToThem = isOwed.reduce((sum, d) => sum + d.amount, 0);
        showParticipantNotice(`Cannot remove this person. They have unsettled debts.`);
        return;
      }
    }

    if (el.participantWarning) {
      el.participantWarning.classList.add('hidden');
    }

    state.participants = state.participants.filter(p => p !== name);
    formSelectedParticipants = formSelectedParticipants.filter(p => p !== name);

    saveState();
    render();
  }

  el.btnSelectAll.addEventListener('click', () => {
    syncFormParticipantsWithGroup();
    renderParticipantChips();
    updateLivePreview();
  });

  el.btnClearAll.addEventListener('click', () => {
    const payer = el.expensePayer.value || state.participants[0];
    formSelectedParticipants = payer ? [payer] : [];
    renderParticipantChips();
    updateLivePreview();
  });

  el.expensePayer.addEventListener('change', () => {
    if (formSelectedParticipants.length === 1) {
      const payer = el.expensePayer.value;
      formSelectedParticipants = payer ? [payer] : [];
      renderParticipantChips();
      updateLivePreview();
    }
  });

  el.expenseAmount.addEventListener('input', updateLivePreview);

  el.formExpense.addEventListener('submit', (e) => {
    e.preventDefault();

    if (state.participants.length < 2) {
      alert('Please add at least 2 participants before adding an expense.');
      return;
    }

    const amount = parseFloat(el.expenseAmount.value);
    const payer = el.expensePayer.value;

    if (isNaN(amount) || amount <= 0) return;
    if (!payer) return;
    if (formSelectedParticipants.length === 0) return;

    state.expenses.push({
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      amount,
      payer,
      participants: [...formSelectedParticipants]
    });

    el.expenseAmount.value = '';
    syncFormParticipantsWithGroup();
    saveState();
    render();
  });

  el.btnReset.addEventListener('click', () => {
    if (confirm('Clear all participants and expenses to start completely fresh?')) {
      state = {
        participants: [],
        expenses: []
      };
      if (el.participantWarning) {
        el.participantWarning.classList.add('hidden');
      }
      localStorage.removeItem(PROCESSED_ORDERS_KEY);
      syncFormParticipantsWithGroup();
      saveState();
      render();
    }
  });

  loadState();
  render();
  checkPaymentReturn();

})();
