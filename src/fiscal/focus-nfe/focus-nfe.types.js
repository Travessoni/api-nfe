"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSOSN_COM_DIFAL = exports.CST_COM_ICMS_TRIBUTADO = void 0;
/** CSTs que tributam ICMS e exigem icms_modalidade_base_calculo (00, 10, 20, 51, 70, 90). */
exports.CST_COM_ICMS_TRIBUTADO = new Set(['00', '10', '20', '51', '70', '90']);
/** CSOSN do Simples Nacional que aceitam DIFAL (102 = tributada sem permissão de crédito). */
exports.CSOSN_COM_DIFAL = new Set(['102', '900']);
