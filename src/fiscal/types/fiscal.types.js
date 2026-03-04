"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegraTributariaNaoEncontradaError = exports.REGRA_TRIBUTARIA_NAO_ENCONTRADA = void 0;
exports.REGRA_TRIBUTARIA_NAO_ENCONTRADA = 'REGRA_TRIBUTARIA_NAO_ENCONTRADA';
var RegraTributariaNaoEncontradaError = /** @class */ (function (_super) {
    __extends(RegraTributariaNaoEncontradaError, _super);
    function RegraTributariaNaoEncontradaError(imposto, ufDestinatario, naturezaId, customMessage) {
        var _this = _super.call(this, customMessage ||
            "Nenhuma regra tribut\u00E1ria encontrada para ".concat(imposto, " na UF ").concat(ufDestinatario, " e natureza ").concat(naturezaId, ". Cadastre uma regra espec\u00EDfica para a UF ou com destinos = 'qualquer'.")) || this;
        _this.imposto = imposto;
        _this.ufDestinatario = ufDestinatario;
        _this.naturezaId = naturezaId;
        _this.code = exports.REGRA_TRIBUTARIA_NAO_ENCONTRADA;
        _this.name = 'RegraTributariaNaoEncontradaError';
        Object.setPrototypeOf(_this, RegraTributariaNaoEncontradaError.prototype);
        return _this;
    }
    return RegraTributariaNaoEncontradaError;
}(Error));
exports.RegraTributariaNaoEncontradaError = RegraTributariaNaoEncontradaError;
