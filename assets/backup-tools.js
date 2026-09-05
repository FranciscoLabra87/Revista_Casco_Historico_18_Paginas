(function (root) {
  "use strict";

  const schema = root.CascoEsquemaRegistros;
  if (!schema) throw new Error("No se pudo cargar el esquema de respaldos.");

  // Fachada conservada para no romper el importador ni integraciones antiguas.
  // Las reglas viven en un único módulo y son las mismas que usa IndexedDB.
  function validateEntries(input, options = {}) {
    return schema.validarColeccion(input, options);
  }

  function validateImageMetadataValue(value) {
    return schema.validarMetadatosImagen(value);
  }

  function validateIssueSettingsValue(value) {
    return schema.validarAjustesEdicion(value);
  }

  function validateStructureValue(value) {
    return schema.validarEstructura(value);
  }

  root.MagazineBackupTools = Object.freeze({
    validateEntries,
    validateImageMetadataValue,
    validateIssueSettingsValue,
    validateStructureValue
  });
})(typeof window === "object" ? window : globalThis);
