/* ==========================================================================
   Google Apps Script Submission & Client-Side Image Compressor
   ========================================================================== */

import { CONFIG } from '../config.js';

export const GasService = {
  /**
   * Compresses an image file in browser to max 1280px dimension and ~75% JPEG quality.
   * Shrinks an 8MB camera photo down to ~250KB without noticeable quality loss.
   */
  async compressImage(file, maxDim = 1280, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Get base64 string without data:image/jpeg;base64, prefix
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64 = dataUrl.split(',')[1];
          resolve({
            filename: file.name.replace(/\.[^/.]+$/, "") + ".jpg",
            base64: base64,
            previewUrl: dataUrl
          });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async postToGas(payload) {
    const jsonStr = JSON.stringify(payload);
    const proxyUrl = `${CONFIG.CLOUDFLARE_PROXY_URL}?url=${encodeURIComponent(CONFIG.UPLOAD_URL)}`;

    let res;
    try {
      res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr
      });
    } catch (e) {
      // Fallback: direct post
      res = await fetch(CONFIG.UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: jsonStr
      });
    }

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    try {
      const json = await res.json();
      return json;
    } catch (e) {
      // GAS often returns HTML redirect on success
      return { status: "SUCCESS" };
    }
  },

  async submitWipOut(picWarehouse, picService, odNumbers, photoObjects) {
    const filesArray = photoObjects.map(p => ({
      file: p.base64,
      filename: p.filename
    }));

    const firstPhoto = photoObjects[0];

    const payload = {
      action: "SUBMIT_WIP",
      picWarehouse: picWarehouse,
      picService: picService,
      odNumber: odNumbers.join(", "),
      file: firstPhoto ? firstPhoto.base64 : "",
      filename: firstPhoto ? firstPhoto.filename : "",
      files: filesArray
    };

    return await this.postToGas(payload);
  },

  async submitWipIn(odNumbers, unit, lokasi, photoObjects) {
    const filesArray = photoObjects.map(p => ({
      file: p.base64,
      filename: p.filename
    }));

    const firstPhoto = photoObjects[0];

    const payload = {
      action: "SUBMIT_WIP_IN",
      odNumber: odNumbers.join(", "),
      unit: unit,
      lokasi: lokasi,
      file: firstPhoto ? firstPhoto.base64 : "",
      filename: firstPhoto ? firstPhoto.filename : "",
      files: filesArray
    };

    return await this.postToGas(payload);
  },

  async submitQcHose(picHose, poSubconRef, pnHose, angle, remarks, photos) {
    const photoList = [
      photos.fotoPanjang,
      photos.fotoCrimp,
      photos.fotoCoupling1,
      photos.fotoCoupling2,
      photos.fotoActual
    ].filter(Boolean);

    const firstPhoto = photoList[0];

    const filesArray = photoList.map(p => ({
      file: p.base64,
      filename: p.filename
    }));

    const payload = {
      action: "SUBMIT_QC_HOSE",
      picHose: picHose,
      poSubconRef: poSubconRef,
      pnHose: pnHose,
      angle: angle,
      remarks: remarks || "",
      file: firstPhoto ? firstPhoto.base64 : "",
      filename: firstPhoto ? firstPhoto.filename : "",
      files: filesArray
    };

    return await this.postToGas(payload);
  },

  async exportAuditReport(pic, jobDescription, items) {
    const payload = {
      action: "EXPORT_AUDIT",
      pic: pic || "",
      jobDescription: jobDescription || "",
      items: items.map(item => ({
        partNumber: item.partNumber,
        description: item.description,
        location: item.location,
        qty: item.qty,
        qtyActual: item.qtyActual || "",
        checked: !!item.checked,
        remarks: item.remarks || ""
      }))
    };
    return await this.postToGas(payload);
  }
};
