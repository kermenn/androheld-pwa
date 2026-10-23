/* ==========================================================================
   Home Screen Bento Grid Module (Mirroring HomeScreen.kt)
   ========================================================================== */

export const HomeModule = {
  init(onNavigate) {
    this.onNavigate = onNavigate;
    this.bindEvents();
  },

  bindEvents() {
    const cardMainTools = document.getElementById('card-main-tools');
    const cardRouteStock = document.getElementById('card-route-stock');
    const cardWipTools = document.getElementById('card-wip-tools');
    const cardQcHose = document.getElementById('card-qc-hose');
    const cardInventory = document.getElementById('card-inventory-report');
    const cardBorrowing = document.getElementById('card-borrowing');
    const cardRoster = document.getElementById('card-roster');

    if (cardInventory) {
      cardInventory.addEventListener('click', () => {
        this.onNavigate('inventory');
      });
    }

    if (cardBorrowing) {
      cardBorrowing.addEventListener('click', () => {
        this.onNavigate('borrowing');
      });
    }

    if (cardRoster) {
      cardRoster.addEventListener('click', () => {
        this.onNavigate('roster');
      });
    }

    if (cardMainTools) {
      cardMainTools.addEventListener('click', () => {
        this.onNavigate('main-tools');
      });
    }

    if (cardRouteStock) {
      cardRouteStock.addEventListener('click', () => {
        this.onNavigate('stock');
      });
    }

    if (cardWipTools) {
      cardWipTools.addEventListener('click', () => {
        this.onNavigate('wip');
      });
    }

    if (cardQcHose) {
      cardQcHose.addEventListener('click', () => {
        this.onNavigate('qc');
      });
    }
  },

  showToast(msg) {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
};
