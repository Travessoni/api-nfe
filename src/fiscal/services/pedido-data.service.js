"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PedidoDataService = void 0;
exports.extrairCstDeSituacaoTributaria = extrairCstDeSituacaoTributaria;
/**
 * Serviço que lê APENAS das tabelas existentes.
 * NÃO altera: pedidos_venda, itens_venda, regras*, naturezaOperacao.
 * Ajuste os nomes das tabelas/colunas conforme seu schema Supabase.
 */
var common_1 = require("@nestjs/common");
var supabase_js_1 = require("@supabase/supabase-js");
/** Extrai código CST (ex: "00") de situacaoTributaria ("00 - Tributada integralmente" ou "102"). */
function extrairCstDeSituacaoTributaria(situacao) {
    if (!situacao || typeof situacao !== 'string')
        return null;
    var trimmed = situacao.trim();
    // Formato "00 - Descrição" ou "102 - Descrição"
    var m = trimmed.match(/^(\d{2,3})\s*-/);
    if (m)
        return m[1];
    // Formato numérico puro: "00", "102", "400"
    if (/^\d{2,3}$/.test(trimmed))
        return trimmed;
    return null;
}
var PedidoDataService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var PedidoDataService = _classThis = /** @class */ (function () {
        function PedidoDataService_1(config) {
            this.config = config;
            this.client = null;
        }
        PedidoDataService_1.prototype.getClient = function () {
            if (!this.client) {
                var url = this.config.get('SUPABASE_URL');
                var key = this.config.get('SUPABASE_SERVICE_ROLE_KEY');
                if (!url || !key)
                    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios');
                this.client = (0, supabase_js_1.createClient)(url, key);
            }
            return this.client;
        };
        PedidoDataService_1.prototype.getPedido = function (pedidoId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('pedidos_venda')
                                .select('*')
                                .eq('id', pedidoId)
                                .maybeSingle()];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error)
                                throw new Error("pedidos_venda: ".concat(error.message));
                            return [2 /*return*/, data];
                    }
                });
            });
        };
        PedidoDataService_1.prototype.getItensVenda = function (pedidoId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('itens_venda')
                                .select('*')
                                .eq('pedido_id', pedidoId)
                                .order('id')];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error)
                                throw new Error("itens_venda: ".concat(error.message));
                            return [2 /*return*/, (data !== null && data !== void 0 ? data : [])];
                    }
                });
            });
        };
        /**
         * Itens do pedido enriquecidos com produto (descricao, ncm) e tributação por categoria
         * (produto_tributacao onde tipo = descricao da categoria) para uso no payload NFe.
         */
        PedidoDataService_1.prototype.getItensVendaEnrichedForFiscal = function (pedidoId) {
            return __awaiter(this, void 0, void 0, function () {
                var itensRaw;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getItensVenda(pedidoId)];
                        case 1:
                            itensRaw = _a.sent();
                            return [2 /*return*/, Promise.all(itensRaw.map(function (item) { return __awaiter(_this, void 0, void 0, function () {
                                    var prodId, enriched, _a, prod, trib;
                                    var _b, _c, _d, _e;
                                    return __generator(this, function (_f) {
                                        switch (_f.label) {
                                            case 0:
                                                prodId = (_b = item.produto) !== null && _b !== void 0 ? _b : item.produto_id;
                                                enriched = __assign({}, item);
                                                if (!(prodId != null)) return [3 /*break*/, 2];
                                                return [4 /*yield*/, Promise.all([
                                                        this.getProduto(Number(prodId)),
                                                        this.getTributacaoByProdutoId(Number(prodId)),
                                                    ])];
                                            case 1:
                                                _a = _f.sent(), prod = _a[0], trib = _a[1];
                                                if (prod) {
                                                    enriched.descricao = (_d = (_c = enriched.descricao) !== null && _c !== void 0 ? _c : prod.descricao) !== null && _d !== void 0 ? _d : prod.nome;
                                                    enriched.ncm = (_e = enriched.ncm) !== null && _e !== void 0 ? _e : prod.ncm;
                                                }
                                                if ((trib === null || trib === void 0 ? void 0 : trib.codigo_ncm) != null)
                                                    enriched.codigo_ncm = trib.codigo_ncm;
                                                if ((trib === null || trib === void 0 ? void 0 : trib.icms_origem) != null)
                                                    enriched.icms_origem = trib.icms_origem;
                                                if ((trib === null || trib === void 0 ? void 0 : trib.icms_situacao_tributaria) != null)
                                                    enriched.icms_situacao_tributaria = trib.icms_situacao_tributaria;
                                                if ((trib === null || trib === void 0 ? void 0 : trib.pis_situacao_tributaria) != null)
                                                    enriched.pis_situacao_tributaria = trib.pis_situacao_tributaria;
                                                if ((trib === null || trib === void 0 ? void 0 : trib.cofins_situacao_tributaria) != null)
                                                    enriched.cofins_situacao_tributaria = trib.cofins_situacao_tributaria;
                                                if ((trib === null || trib === void 0 ? void 0 : trib.tipo) != null)
                                                    enriched.tipo = trib.tipo;
                                                if ((trib === null || trib === void 0 ? void 0 : trib.pis_aliquota_porcentual) != null)
                                                    enriched.pis_aliquota_porcentual = String(trib.pis_aliquota_porcentual);
                                                if ((trib === null || trib === void 0 ? void 0 : trib.cofins_aliquota_porcentual) != null)
                                                    enriched.cofins_aliquota_porcentual = String(trib.cofins_aliquota_porcentual);
                                                _f.label = 2;
                                            case 2: return [2 /*return*/, enriched];
                                        }
                                    });
                                }); }))];
                    }
                });
            });
        };
        PedidoDataService_1.prototype.getEnderecoById = function (enderecoId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('enderecos')
                                .select('*')
                                .eq('id', enderecoId)
                                .maybeSingle()];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error)
                                throw new Error("enderecos: ".concat(error.message));
                            return [2 /*return*/, data];
                    }
                });
            });
        };
        PedidoDataService_1.prototype.getEnderecoByContatoId = function (contatoId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.getClient()
                                    .from('enderecos')
                                    .select('*')
                                    .eq('contato_id', contatoId)
                                    .limit(1)
                                    .maybeSingle()];
                        case 1:
                            _a = _c.sent(), data = _a.data, error = _a.error;
                            if (error)
                                return [2 /*return*/, null];
                            return [2 /*return*/, data];
                        case 2:
                            _b = _c.sent();
                            return [2 /*return*/, null];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        /** Retorna todos os endereços do contato (para seleção no formulário de NF). */
        PedidoDataService_1.prototype.getEnderecosByContatoId = function (contatoId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.getClient()
                                    .from('enderecos')
                                    .select('*')
                                    .eq('contato_id', contatoId)];
                        case 1:
                            _a = _c.sent(), data = _a.data, error = _a.error;
                            if (error || !data)
                                return [2 /*return*/, []];
                            return [2 /*return*/, data || []];
                        case 2:
                            _b = _c.sent();
                            return [2 /*return*/, []];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        PedidoDataService_1.prototype.getEmpresa = function (empresaId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error, row, enderecoId, endereco;
                var _b, _c, _d, _e, _f, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('empresas')
                                .select('*')
                                .eq('id', empresaId)
                                .maybeSingle()];
                        case 1:
                            _a = _h.sent(), data = _a.data, error = _a.error;
                            if (error)
                                throw new Error("empresas: ".concat(error.message));
                            if (!data)
                                return [2 /*return*/, null];
                            row = data;
                            enderecoId = row.endereco != null ? Number(row.endereco) : null;
                            if (!(enderecoId != null)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.getEnderecoById(enderecoId)];
                        case 2:
                            endereco = _h.sent();
                            if (endereco) {
                                row.logradouro = (_b = endereco.rua) !== null && _b !== void 0 ? _b : row.logradouro;
                                row.numero = (_c = endereco.numero) !== null && _c !== void 0 ? _c : row.numero;
                                row.bairro = (_d = endereco.bairro) !== null && _d !== void 0 ? _d : row.bairro;
                                row.municipio = (_e = endereco.cidade) !== null && _e !== void 0 ? _e : row.municipio;
                                row.uf = (_f = endereco.estado) !== null && _f !== void 0 ? _f : row.uf;
                                row.cep = (_g = endereco.cep) !== null && _g !== void 0 ? _g : row.cep;
                            }
                            _h.label = 3;
                        case 3: return [2 /*return*/, row];
                    }
                });
            });
        };
        /** Busca empresa pelo CNPJ (apenas dígitos). Usado para obter regime tributário quando o payload não traz empresa_id. */
        PedidoDataService_1.prototype.getEmpresaByCnpj = function (cnpj) {
            return __awaiter(this, void 0, void 0, function () {
                var digits, _a, data, error, row, enderecoId, endereco;
                var _b, _c, _d, _e, _f, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0:
                            digits = (cnpj !== null && cnpj !== void 0 ? cnpj : '').replace(/\D/g, '');
                            if (digits.length !== 14)
                                return [2 /*return*/, null];
                            return [4 /*yield*/, this.getClient()
                                    .from('empresas')
                                    .select('*')
                                    .eq('cnpj', digits)
                                    .maybeSingle()];
                        case 1:
                            _a = _h.sent(), data = _a.data, error = _a.error;
                            if (error || !data)
                                return [2 /*return*/, null];
                            row = data;
                            enderecoId = row.endereco != null ? Number(row.endereco) : null;
                            if (!(enderecoId != null)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.getEnderecoById(enderecoId)];
                        case 2:
                            endereco = _h.sent();
                            if (endereco) {
                                row.logradouro = (_b = endereco.rua) !== null && _b !== void 0 ? _b : row.logradouro;
                                row.numero = (_c = endereco.numero) !== null && _c !== void 0 ? _c : row.numero;
                                row.bairro = (_d = endereco.bairro) !== null && _d !== void 0 ? _d : row.bairro;
                                row.municipio = (_e = endereco.cidade) !== null && _e !== void 0 ? _e : row.municipio;
                                row.uf = (_f = endereco.estado) !== null && _f !== void 0 ? _f : row.uf;
                                row.cep = (_g = endereco.cep) !== null && _g !== void 0 ? _g : row.cep;
                            }
                            _h.label = 3;
                        case 3: return [2 /*return*/, row];
                    }
                });
            });
        };
        /** Retorna o nome do contato pelo pedido_id (para listagem de NF). Tenta contato_id e id na tabela contatos. */
        PedidoDataService_1.prototype.getNomeContatoByPedidoId = function (pedidoId) {
            return __awaiter(this, void 0, void 0, function () {
                var info;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getPedidoInfoParaListagem(pedidoId)];
                        case 1:
                            info = _a.sent();
                            return [2 /*return*/, info.nomeContato];
                    }
                });
            });
        };
        /** Retorna nome do contato e total do pedido (pedido_id -> pedidos_venda -> contatos_id -> contatos). */
        PedidoDataService_1.prototype.getPedidoInfoParaListagem = function (pedidoId) {
            return __awaiter(this, void 0, void 0, function () {
                var pedido, ped, totalPedido, contatosId, fetchContato, data, nomeContato;
                var _this = this;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0: return [4 /*yield*/, this.getPedido(pedidoId)];
                        case 1:
                            pedido = _e.sent();
                            if (!pedido)
                                return [2 /*return*/, { nomeContato: null, totalPedido: null }];
                            ped = pedido;
                            totalPedido = ped.totalPedido != null ? Number(ped.totalPedido) : ped.valor_total != null ? Number(ped.valor_total) : null;
                            contatosId = ped.contatos_id != null
                                ? Number(ped.contatos_id)
                                : ped.contato_id != null
                                    ? Number(ped.contato_id)
                                    : ped.cliente_id != null
                                        ? Number(ped.cliente_id)
                                        : null;
                            if (contatosId == null)
                                return [2 /*return*/, { nomeContato: null, totalPedido: totalPedido }];
                            fetchContato = function (table) { return __awaiter(_this, void 0, void 0, function () {
                                var byContatoId, byId;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.getClient()
                                                .from(table)
                                                .select('*')
                                                .eq('contato_id', contatosId)
                                                .maybeSingle()];
                                        case 1:
                                            byContatoId = _a.sent();
                                            if (!byContatoId.error && byContatoId.data)
                                                return [2 /*return*/, byContatoId.data];
                                            return [4 /*yield*/, this.getClient()
                                                    .from(table)
                                                    .select('*')
                                                    .eq('id', contatosId)
                                                    .maybeSingle()];
                                        case 2:
                                            byId = _a.sent();
                                            if (!byId.error && byId.data)
                                                return [2 /*return*/, byId.data];
                                            return [2 /*return*/, null];
                                    }
                                });
                            }); };
                            return [4 /*yield*/, fetchContato('contatos')];
                        case 2:
                            data = _e.sent();
                            if (!!data) return [3 /*break*/, 4];
                            return [4 /*yield*/, fetchContato('contato')];
                        case 3:
                            data = _e.sent();
                            _e.label = 4;
                        case 4:
                            nomeContato = data
                                ? ((_d = (_c = (_b = (_a = data.nome) !== null && _a !== void 0 ? _a : data.razao_social) !== null && _b !== void 0 ? _b : data.nome_fantasia) !== null && _c !== void 0 ? _c : data.name) !== null && _d !== void 0 ? _d : null)
                                : null;
                            return [2 /*return*/, { nomeContato: nomeContato, totalPedido: totalPedido }];
                    }
                });
            });
        };
        /**
         * Resolve o contato do pedido (pedido_id -> pedidos_venda.contatos_id -> contatos).
         * Usado pelo frontend para exibir "Cliente" no formulário de NF sem entrada manual.
         */
        PedidoDataService_1.prototype.getContatoByPedidoId = function (pedidoId) {
            return __awaiter(this, void 0, void 0, function () {
                var pedido, ped, contatosId, fetchContato, data, nome;
                var _this = this;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0: return [4 /*yield*/, this.getPedido(pedidoId)];
                        case 1:
                            pedido = _e.sent();
                            if (!pedido)
                                return [2 /*return*/, { contato_id: null, nome: null }];
                            ped = pedido;
                            contatosId = ped.contatos_id != null
                                ? Number(ped.contatos_id)
                                : ped.contato_id != null
                                    ? Number(ped.contato_id)
                                    : ped.cliente_id != null
                                        ? Number(ped.cliente_id)
                                        : null;
                            if (contatosId == null)
                                return [2 /*return*/, { contato_id: null, nome: null }];
                            fetchContato = function (table) { return __awaiter(_this, void 0, void 0, function () {
                                var byContatoId, byId;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.getClient()
                                                .from(table)
                                                .select('*')
                                                .eq('contato_id', contatosId)
                                                .maybeSingle()];
                                        case 1:
                                            byContatoId = _a.sent();
                                            if (!byContatoId.error && byContatoId.data)
                                                return [2 /*return*/, byContatoId.data];
                                            return [4 /*yield*/, this.getClient()
                                                    .from(table)
                                                    .select('*')
                                                    .eq('id', contatosId)
                                                    .maybeSingle()];
                                        case 2:
                                            byId = _a.sent();
                                            if (!byId.error && byId.data)
                                                return [2 /*return*/, byId.data];
                                            return [2 /*return*/, null];
                                    }
                                });
                            }); };
                            return [4 /*yield*/, fetchContato('contatos')];
                        case 2:
                            data = _e.sent();
                            if (!!data) return [3 /*break*/, 4];
                            return [4 /*yield*/, fetchContato('contato')];
                        case 3:
                            data = _e.sent();
                            _e.label = 4;
                        case 4:
                            nome = data ? ((_d = (_c = (_b = (_a = data.nome) !== null && _a !== void 0 ? _a : data.razao_social) !== null && _b !== void 0 ? _b : data.nome_fantasia) !== null && _c !== void 0 ? _c : data.name) !== null && _d !== void 0 ? _d : null) : null;
                            return [2 /*return*/, { contato_id: contatosId, nome: nome }];
                    }
                });
            });
        };
        /**
         * Atualiza contato com dados de contribuinte ICMS (ie, contribuinte_icms, indIEDest).
         * Tenta atualizar na tabela "contatos" por id; se a tabela for "contato", ajuste o nome.
         */
        PedidoDataService_1.prototype.updateContatoContribuinte = function (contatoId, data) {
            return __awaiter(this, void 0, void 0, function () {
                var client, payload, errContatos, errContato;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            client = this.getClient();
                            payload = {
                                ie: data.ie || null,
                                inscricao_estadual: data.ie || null,
                                contribuinte_icms: data.contribuinte_icms,
                                indIEDest: data.indIEDest,
                            };
                            return [4 /*yield*/, client
                                    .from('contatos')
                                    .update(payload)
                                    .eq('id', contatoId)];
                        case 1:
                            errContatos = (_a.sent()).error;
                            if (!errContatos)
                                return [2 /*return*/, true];
                            return [4 /*yield*/, client
                                    .from('contato')
                                    .update(__assign({}, payload))
                                    .eq('id', contatoId)];
                        case 2:
                            errContato = (_a.sent()).error;
                            return [2 /*return*/, !errContato];
                    }
                });
            });
        };
        PedidoDataService_1.prototype.getCliente = function (contatoId) {
            return __awaiter(this, void 0, void 0, function () {
                var fetchFromTable, row, endereco, enderecosList;
                var _this = this;
                var _a, _b, _c, _d, _e, _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0:
                            fetchFromTable = function (table) { return __awaiter(_this, void 0, void 0, function () {
                                var byContatoId, byId, r;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.getClient()
                                                .from(table)
                                                .select('*')
                                                .eq('contato_id', contatoId)
                                                .maybeSingle()];
                                        case 1:
                                            byContatoId = _a.sent();
                                            if (!byContatoId.error && byContatoId.data)
                                                return [2 /*return*/, byContatoId.data];
                                            return [4 /*yield*/, this.getClient()
                                                    .from(table)
                                                    .select('*')
                                                    .eq('id', contatoId)
                                                    .maybeSingle()];
                                        case 2:
                                            byId = _a.sent();
                                            if (!byId.error && byId.data) {
                                                r = byId.data;
                                                r.contato_id = contatoId;
                                                return [2 /*return*/, r];
                                            }
                                            return [2 /*return*/, null];
                                    }
                                });
                            }); };
                            return [4 /*yield*/, fetchFromTable('contatos')];
                        case 1:
                            row = _j.sent();
                            if (!!row) return [3 /*break*/, 3];
                            return [4 /*yield*/, fetchFromTable('contato')];
                        case 2:
                            row = _j.sent();
                            _j.label = 3;
                        case 3:
                            if (!row)
                                return [2 /*return*/, null];
                            row.contato_id = contatoId;
                            this.normalizeClienteRow(row);
                            return [4 /*yield*/, this.getEnderecoByContatoId(contatoId)];
                        case 4:
                            endereco = _j.sent();
                            if (endereco) {
                                row.logradouro = (_a = endereco.rua) !== null && _a !== void 0 ? _a : row.logradouro;
                                row.numero = (_b = endereco.numero) !== null && _b !== void 0 ? _b : row.numero;
                                row.bairro = (_c = endereco.bairro) !== null && _c !== void 0 ? _c : row.bairro;
                                row.municipio = (_d = endereco.cidade) !== null && _d !== void 0 ? _d : row.municipio;
                                row.uf = (_e = endereco.estado) !== null && _e !== void 0 ? _e : row.uf;
                                row.cep = (_f = endereco.cep) !== null && _f !== void 0 ? _f : row.cep;
                                row.complemento = (_g = endereco.complemento) !== null && _g !== void 0 ? _g : row.complemento;
                            }
                            return [4 /*yield*/, this.getEnderecosByContatoId(contatoId)];
                        case 5:
                            enderecosList = _j.sent();
                            row.enderecos = enderecosList.map(function (e) { return ({
                                rua: e.rua,
                                logradouro: e.rua,
                                numero: e.numero,
                                bairro: e.bairro,
                                cidade: e.cidade,
                                municipio: e.cidade,
                                uf: e.estado,
                                estado: e.estado,
                                cep: e.cep,
                                complemento: e.complemento,
                                tipoEndereco: e.tipoEndereco,
                                tipo: e.tipo,
                            }); });
                            row.pais = (_h = row.pais) !== null && _h !== void 0 ? _h : 'Brasil';
                            return [2 /*return*/, row];
                    }
                });
            });
        };
        /** Normaliza campos do contato para PJ (cnpj/razao_social) e PF (cpf/nome). */
        PedidoDataService_1.prototype.normalizeClienteRow = function (row) {
            var _a, _b, _c, _d, _e, _f;
            var cpfCnpj = (_b = (_a = row.cpf_cnpj) !== null && _a !== void 0 ? _a : row.cnpj) !== null && _b !== void 0 ? _b : row.cpf;
            if (cpfCnpj != null && row.cpf_cnpj == null)
                row.cpf_cnpj = String(cpfCnpj).trim();
            var nome = (_e = (_d = (_c = row.nome) !== null && _c !== void 0 ? _c : row.razao_social) !== null && _d !== void 0 ? _d : row.nome_fantasia) !== null && _e !== void 0 ? _e : row.name;
            if (nome != null && row.nome == null)
                row.nome = String(nome).trim();
            var ie = (_f = row.ie) !== null && _f !== void 0 ? _f : row.inscricao_estadual;
            if (ie != null && row.ie == null)
                row.ie = String(ie).trim();
        };
        /** Formata dígitos como CPF (11) ou CNPJ (14) para busca em coluna formatada. */
        PedidoDataService_1.prototype.formatDocForSearch = function (digits) {
            var d = digits.replace(/\D/g, '');
            if (d.length <= 11) {
                return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, function (_, a, b, c, d2) {
                    return a + (b ? ".".concat(b) : '') + (c ? ".".concat(c) : '') + (d2 ? "-".concat(d2) : '');
                });
            }
            return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, function (_, a, b, c, d2, e) {
                return a + (b ? ".".concat(b) : '') + (c ? ".".concat(c) : '') + (d2 ? "/".concat(d2) : '') + (e ? "-".concat(e) : '');
            });
        };
        /** Busca contatos por nome ou cpf/cnpj (tabela contatos). Várias buscas com .ilike() para ser robusto ao schema. */
        PedidoDataService_1.prototype.searchContatos = function (busca) {
            return __awaiter(this, void 0, void 0, function () {
                var q, escaped, pattern, client, normalize, seen, out, add, onlyDigits, digitsPattern, _a, dataRaw, errRaw, formatted, patternFormatted, _b, dataFmt, errFmt, byNome, byName, byRazao, byFantasia, _c;
                var _d, _e, _f, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0:
                            q = (busca || '').trim();
                            if (q.length < 2)
                                return [2 /*return*/, []];
                            escaped = q.replace(/'/g, "''");
                            pattern = "%".concat(escaped, "%");
                            client = this.getClient();
                            normalize = function (r) {
                                var _a, _b, _c, _d, _e, _f;
                                return ({
                                    id: Number((_b = (_a = r.id) !== null && _a !== void 0 ? _a : r.contato_id) !== null && _b !== void 0 ? _b : 0),
                                    nome: String((_f = (_e = (_d = (_c = r.nome) !== null && _c !== void 0 ? _c : r.nome_fantasia) !== null && _d !== void 0 ? _d : r.razao_social) !== null && _e !== void 0 ? _e : r.name) !== null && _f !== void 0 ? _f : ''),
                                    nome_fantasia: r.nome_fantasia != null ? String(r.nome_fantasia) : undefined,
                                    razao_social: r.razao_social != null ? String(r.razao_social) : undefined,
                                    cpf_cnpj: r.cpf_cnpj != null ? String(r.cpf_cnpj) : undefined,
                                });
                            };
                            seen = new Set();
                            out = [];
                            add = function (rows) {
                                (rows || []).forEach(function (row) {
                                    var _a;
                                    var r = row;
                                    var id = Number((_a = r.id) !== null && _a !== void 0 ? _a : r.contato_id);
                                    if (id && !seen.has(id)) {
                                        seen.add(id);
                                        out.push(normalize(r));
                                    }
                                });
                            };
                            _h.label = 1;
                        case 1:
                            _h.trys.push([1, 12, , 13]);
                            onlyDigits = /^\d+$/.test(q);
                            if (!onlyDigits) return [3 /*break*/, 4];
                            digitsPattern = pattern;
                            return [4 /*yield*/, client.from('contatos').select('*').ilike('cpf_cnpj', digitsPattern).limit(20)];
                        case 2:
                            _a = _h.sent(), dataRaw = _a.data, errRaw = _a.error;
                            if (!errRaw && (dataRaw === null || dataRaw === void 0 ? void 0 : dataRaw.length))
                                add(dataRaw);
                            formatted = this.formatDocForSearch(q);
                            if (!(formatted !== q)) return [3 /*break*/, 4];
                            patternFormatted = "%".concat(formatted.replace(/'/g, "''"), "%");
                            return [4 /*yield*/, client.from('contatos').select('*').ilike('cpf_cnpj', patternFormatted).limit(20)];
                        case 3:
                            _b = _h.sent(), dataFmt = _b.data, errFmt = _b.error;
                            if (!errFmt && (dataFmt === null || dataFmt === void 0 ? void 0 : dataFmt.length))
                                add(dataFmt);
                            _h.label = 4;
                        case 4: return [4 /*yield*/, client.from('contatos').select('*').ilike('nome', pattern).limit(20)];
                        case 5:
                            byNome = _h.sent();
                            if (!byNome.error) return [3 /*break*/, 7];
                            return [4 /*yield*/, client.from('contatos').select('*').ilike('name', pattern).limit(20)];
                        case 6:
                            byName = _h.sent();
                            if (!byName.error && ((_d = byName.data) === null || _d === void 0 ? void 0 : _d.length))
                                add(byName.data);
                            return [3 /*break*/, 8];
                        case 7:
                            if ((_e = byNome.data) === null || _e === void 0 ? void 0 : _e.length) {
                                add(byNome.data);
                            }
                            _h.label = 8;
                        case 8:
                            if (!!onlyDigits) return [3 /*break*/, 11];
                            return [4 /*yield*/, client.from('contatos').select('*').ilike('razao_social', pattern).limit(20)];
                        case 9:
                            byRazao = _h.sent();
                            if (!byRazao.error && ((_f = byRazao.data) === null || _f === void 0 ? void 0 : _f.length))
                                add(byRazao.data);
                            return [4 /*yield*/, client.from('contatos').select('*').ilike('nome_fantasia', pattern).limit(20)];
                        case 10:
                            byFantasia = _h.sent();
                            if (!byFantasia.error && ((_g = byFantasia.data) === null || _g === void 0 ? void 0 : _g.length))
                                add(byFantasia.data);
                            _h.label = 11;
                        case 11: return [2 /*return*/, out.slice(0, 20)];
                        case 12:
                            _c = _h.sent();
                            return [2 /*return*/, []];
                        case 13: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Busca transportadoras na tabela contatos, filtrando tipo_cadastro = 'transportadora'.
         * Pesquisa principal pelo campo nome; se não encontrar, tenta razão social e nome fantasia.
         */
        PedidoDataService_1.prototype.searchTransportadoras = function (busca) {
            return __awaiter(this, void 0, void 0, function () {
                var q, escaped, pattern, client, normalize, seen, out, add, _a, data, error, _b, dataAlt, errAlt, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            q = (busca || '').trim();
                            if (q.length < 2)
                                return [2 /*return*/, []];
                            escaped = q.replace(/'/g, "''");
                            pattern = "%".concat(escaped, "%");
                            client = this.getClient();
                            normalize = function (r) {
                                var _a, _b, _c, _d, _e, _f;
                                return ({
                                    id: Number((_b = (_a = r.id) !== null && _a !== void 0 ? _a : r.contato_id) !== null && _b !== void 0 ? _b : 0),
                                    nome: String((_f = (_e = (_d = (_c = r.nome) !== null && _c !== void 0 ? _c : r.nome_fantasia) !== null && _d !== void 0 ? _d : r.razao_social) !== null && _e !== void 0 ? _e : r.name) !== null && _f !== void 0 ? _f : ''),
                                    nome_fantasia: r.nome_fantasia != null ? String(r.nome_fantasia) : undefined,
                                    razao_social: r.razao_social != null ? String(r.razao_social) : undefined,
                                    cpf_cnpj: r.cpf_cnpj != null ? String(r.cpf_cnpj) : undefined,
                                });
                            };
                            seen = new Set();
                            out = [];
                            add = function (rows) {
                                (rows || []).forEach(function (row) {
                                    var _a;
                                    var r = row;
                                    var id = Number((_a = r.id) !== null && _a !== void 0 ? _a : r.contato_id);
                                    if (id && !seen.has(id)) {
                                        seen.add(id);
                                        out.push(normalize(r));
                                    }
                                });
                            };
                            _d.label = 1;
                        case 1:
                            _d.trys.push([1, 5, , 6]);
                            return [4 /*yield*/, client
                                    .from('contatos')
                                    .select('*')
                                    .eq('tipo_cadastro', 'transportadora')
                                    .ilike('nome', pattern)
                                    .limit(20)];
                        case 2:
                            _a = _d.sent(), data = _a.data, error = _a.error;
                            if (!error && (data === null || data === void 0 ? void 0 : data.length))
                                add(data);
                            if (!!out.length) return [3 /*break*/, 4];
                            return [4 /*yield*/, client
                                    .from('contatos')
                                    .select('*')
                                    .eq('tipo_cadastro', 'transportadora')
                                    .or("razao_social.ilike.".concat(pattern, ",nome_fantasia.ilike.").concat(pattern))
                                    .limit(20)];
                        case 3:
                            _b = _d.sent(), dataAlt = _b.data, errAlt = _b.error;
                            if (!errAlt && (dataAlt === null || dataAlt === void 0 ? void 0 : dataAlt.length))
                                add(dataAlt);
                            _d.label = 4;
                        case 4: return [2 /*return*/, out];
                        case 5:
                            _c = _d.sent();
                            return [2 /*return*/, []];
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        PedidoDataService_1.prototype.getProduto = function (produtoId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error, row;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('produtos')
                                .select('*')
                                .eq('id', produtoId)
                                .maybeSingle()];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error)
                                return [2 /*return*/, null];
                            row = data;
                            if (!row)
                                return [2 /*return*/, null];
                            return [2 /*return*/, {
                                    nome: row.nome != null ? String(row.nome) : row.descricao != null ? String(row.descricao) : undefined,
                                    descricao: row.descricao != null ? String(row.descricao) : row.nome != null ? String(row.nome) : undefined,
                                    ncm: row.ncm != null ? String(row.ncm) : (row.codigo_ncm != null ? String(row.codigo_ncm) : undefined),
                                }];
                    }
                });
            });
        };
        /**
         * Tributação por produto_id: uma única query com JOINs.
         * Produtos → produto_categoria (categoria) → produto_tributacao (tipo = descricao da categoria).
         * Requer a função get_tributacao_by_produto_id no Supabase (migração 002).
         */
        PedidoDataService_1.prototype.getTributacaoByProdutoId = function (produtoId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error, row;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .rpc('get_tributacao_by_produto_id', { p_produto_id: produtoId })];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error)
                                throw new Error("get_tributacao_by_produto_id: ".concat(error.message));
                            row = Array.isArray(data) ? data[0] : data;
                            return [2 /*return*/, (row !== null && row !== void 0 ? row : null)];
                    }
                });
            });
        };
        /** Regras ICMS por natureza. Tenta tabela regrasICMS/regrasicms e coluna naturezaRef/naturezaref (Postgres pode armazenar em minúsculas). */
        PedidoDataService_1.prototype.getRegrasICMSByNatureza = function (naturezaId) {
            return __awaiter(this, void 0, void 0, function () {
                var tables, cols, lastError, _i, tables_1, table, _a, cols_1, col, _b, data, error;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            tables = ['regrasICMS', 'regrasicms'];
                            cols = ['naturezaRef', 'naturezaref'];
                            lastError = null;
                            _i = 0, tables_1 = tables;
                            _c.label = 1;
                        case 1:
                            if (!(_i < tables_1.length)) return [3 /*break*/, 6];
                            table = tables_1[_i];
                            _a = 0, cols_1 = cols;
                            _c.label = 2;
                        case 2:
                            if (!(_a < cols_1.length)) return [3 /*break*/, 5];
                            col = cols_1[_a];
                            return [4 /*yield*/, this.getClient()
                                    .from(table)
                                    .select('*')
                                    .eq(col, naturezaId)];
                        case 3:
                            _b = _c.sent(), data = _b.data, error = _b.error;
                            if (error)
                                lastError = error.message;
                            if (!error && (data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, data];
                            _c.label = 4;
                        case 4:
                            _a++;
                            return [3 /*break*/, 2];
                        case 5:
                            _i++;
                            return [3 /*break*/, 1];
                        case 6:
                            if (lastError && process.env.NODE_ENV !== 'production') {
                                console.warn('[getRegrasICMSByNatureza] nenhuma linha encontrada. Último erro Supabase:', lastError);
                            }
                            return [2 /*return*/, []];
                    }
                });
            });
        };
        /**
         * Retorna uma regra cujo destinos contém a UF (ex.: "SP" ou "AC, SP, MG") ou cujo destinos é "qualquer".
         * Prioridade 1: regra com destinos contendo ufDestinatario.
         * Prioridade 2: regra com destinos = 'qualquer' (case-insensitive).
         */
        PedidoDataService_1.prototype.destinosContemUF = function (destinos, uf) {
            if (!uf)
                return false;
            var ufNorm = String(uf).trim().toUpperCase();
            if (!destinos || String(destinos).trim() === '')
                return false;
            var partes = String(destinos)
                .split(/[,\s]+/)
                .map(function (p) { return p.trim().toUpperCase(); })
                .filter(Boolean);
            if (partes.some(function (p) { return p === 'QUALQUER'; }))
                return true;
            return partes.includes(ufNorm);
        };
        PedidoDataService_1.prototype.pickRegraPorDestino = function (regras, ufDestinatario) {
            var _this = this;
            if (!(regras === null || regras === void 0 ? void 0 : regras.length))
                return null;
            var uf = String(ufDestinatario !== null && ufDestinatario !== void 0 ? ufDestinatario : '').trim().toUpperCase();
            var getDestinos = function (r) {
                var _a;
                var rec = r;
                var d = (_a = rec.destinos) !== null && _a !== void 0 ? _a : rec.Destinos;
                return d == null ? null : String(d);
            };
            var qualquer = function (d) {
                return d != null && String(d).trim().toLowerCase() === 'qualquer';
            };
            var matchUF = regras.find(function (r) { return _this.destinosContemUF(getDestinos(r), uf); });
            if (matchUF)
                return matchUF;
            var matchQualquer = regras.find(function (r) { return qualquer(getDestinos(r)); });
            return matchQualquer !== null && matchQualquer !== void 0 ? matchQualquer : null;
        };
        /** Regra ICMS para a UF do destinatário (prioridade: destinos contém UF, depois destinos = 'qualquer'). */
        PedidoDataService_1.prototype.getRegraICMSParaDestino = function (naturezaId, ufDestinatario) {
            return __awaiter(this, void 0, void 0, function () {
                var regras;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getRegrasICMSByNatureza(naturezaId)];
                        case 1:
                            regras = _a.sent();
                            return [2 /*return*/, this.pickRegraPorDestino(regras, ufDestinatario)];
                    }
                });
            });
        };
        /** Regra PIS para a UF do destinatário (tabela regrasPIS, coluna naturezaRef e destinos). */
        PedidoDataService_1.prototype.getRegraPISParaDestino = function (naturezaId, ufDestinatario) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasPIS')
                                .select('*')
                                .eq('naturezaRef', naturezaId)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, this.pickRegraPorDestino(data, ufDestinatario)];
                    }
                });
            });
        };
        /** Regra COFINS para a UF do destinatário (tabela regrasCOFINS, coluna naturezaRef e destinos). */
        PedidoDataService_1.prototype.getRegraCOFINSParaDestino = function (naturezaId, ufDestinatario) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasCOFINS')
                                .select('*')
                                .eq('naturezaRef', naturezaId)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, this.pickRegraPorDestino(data, ufDestinatario)];
                    }
                });
            });
        };
        /** Regra IPI para a UF do destinatário (tabela regrasIPI, coluna naturezaRef e destinos). */
        PedidoDataService_1.prototype.getRegraIPIParaDestino = function (naturezaId, ufDestinatario) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasIPI')
                                .select('*')
                                .eq('naturezaRef', naturezaId)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, this.pickRegraPorDestino(data, ufDestinatario)];
                    }
                });
            });
        };
        /** Regra Retenções por natureza (tabela regrasRETENCOES não possui coluna destinos; retorna primeira regra da natureza). */
        PedidoDataService_1.prototype.getRegraRetencoesParaDestino = function (naturezaId, _ufDestinatario) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasRETENCOES')
                                .select('*')
                                .eq('naturezaRef', naturezaId)
                                .limit(1)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, data[0]];
                    }
                });
            });
        };
        /** Regra IS para a UF do destinatário (tabela regrasis, colunas naturezaRef e destinos). */
        PedidoDataService_1.prototype.getRegraISParaDestino = function (naturezaId, ufDestinatario) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasis')
                                .select('*')
                                .eq('naturezaRef', naturezaId)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, this.pickRegraPorDestino(data, ufDestinatario)];
                    }
                });
            });
        };
        /** Regra IBS para a UF do destinatário (tabela regrasibs, colunas naturezaRef e destinos). */
        PedidoDataService_1.prototype.getRegraIBSParaDestino = function (naturezaId, ufDestinatario) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasibs')
                                .select('*')
                                .eq('naturezaRef', naturezaId)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, this.pickRegraPorDestino(data, ufDestinatario)];
                    }
                });
            });
        };
        /** Regra CBS para a UF do destinatário (tabela regrascbs, colunas naturezaRef e destinos). */
        PedidoDataService_1.prototype.getRegraCBSParaDestino = function (naturezaId, ufDestinatario) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrascbs')
                                .select('*')
                                .eq('naturezaRef', naturezaId)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, this.pickRegraPorDestino(data, ufDestinatario)];
                    }
                });
            });
        };
        /** Regras PIS por natureza de operação (tabela regrasPIS). Retorna todas as regras para seleção por UF do destinatário. */
        PedidoDataService_1.prototype.getRegrasPISByNatureza = function (naturezaId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasPIS')
                                .select('*')
                                .eq('naturezaRef', naturezaId)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error)
                                return [2 /*return*/, []];
                            return [2 /*return*/, (data !== null && data !== void 0 ? data : [])];
                    }
                });
            });
        };
        /** Regras COFINS por natureza de operação (tabela regrasCOFINS). Retorna todas as regras para seleção por UF do destinatário. */
        PedidoDataService_1.prototype.getRegrasCOFINSByNatureza = function (naturezaId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasCOFINS')
                                .select('*')
                                .eq('naturezaRef', naturezaId)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error)
                                return [2 /*return*/, []];
                            return [2 /*return*/, (data !== null && data !== void 0 ? data : [])];
                    }
                });
            });
        };
        /** Regras IPI por natureza de operação (tabela regrasIPI). */
        PedidoDataService_1.prototype.getRegrasIPIByNatureza = function (naturezaId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasIPI')
                                .select('*')
                                .eq('naturezaRef', naturezaId)
                                .limit(1)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, data[0]];
                    }
                });
            });
        };
        /** Regras de retenções por natureza de operação (tabela regrasRETENCOES). */
        PedidoDataService_1.prototype.getRegrasRetencoesByNatureza = function (naturezaId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasRETENCOES')
                                .select('*')
                                .eq('naturezaRef', naturezaId)
                                .limit(1)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, data[0]];
                    }
                });
            });
        };
        /** Regras IS por natureza (tabela regrasis, coluna naturezaRef). */
        PedidoDataService_1.prototype.getRegrasISByNatureza = function (naturezaId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasis')
                                .select('*')
                                .eq('naturezaRef', naturezaId)
                                .limit(1)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, data[0]];
                    }
                });
            });
        };
        /** Regras IBS por natureza (tabela regrasibs, coluna naturezaRef). */
        PedidoDataService_1.prototype.getRegrasIBSByNatureza = function (naturezaId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrasibs')
                                .select('*')
                                .eq('naturezaRef', naturezaId)
                                .limit(1)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, data[0]];
                    }
                });
            });
        };
        /** Regras CBS por natureza (tabela regrascbs, coluna naturezaRef). */
        PedidoDataService_1.prototype.getRegrasCBSByNatureza = function (naturezaId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('regrascbs')
                                .select('*')
                                .eq('naturezaRef', naturezaId)
                                .limit(1)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error || !(data === null || data === void 0 ? void 0 : data.length))
                                return [2 /*return*/, null];
                            return [2 /*return*/, data[0]];
                    }
                });
            });
        };
        PedidoDataService_1.prototype.getNaturezaOperacao = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var tablesToTry, lastError, _i, tablesToTry_1, table, _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tablesToTry = ['naturezaOperacao', 'natureza_operacao', 'naturezas_operacao'];
                            lastError = null;
                            _i = 0, tablesToTry_1 = tablesToTry;
                            _b.label = 1;
                        case 1:
                            if (!(_i < tablesToTry_1.length)) return [3 /*break*/, 4];
                            table = tablesToTry_1[_i];
                            return [4 /*yield*/, this.getClient()
                                    .from(table)
                                    .select('*')
                                    .eq('id', id)
                                    .maybeSingle()];
                        case 2:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (!error && data)
                                return [2 /*return*/, data];
                            if (error)
                                lastError = error.message;
                            _b.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4: return [2 /*return*/, null];
                    }
                });
            });
        };
        PedidoDataService_1.prototype.listEmpresas = function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getClient()
                                .from('empresas')
                                .select('id, nome, nomeFantasia')
                                .order('id')];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error)
                                throw new Error("empresas: ".concat(error.message));
                            return [2 /*return*/, (data !== null && data !== void 0 ? data : []).map(function (row) {
                                    var _a;
                                    return ({
                                        id: Number(row.id),
                                        razao_social: String((_a = row.nome) !== null && _a !== void 0 ? _a : ''),
                                        nome_fantasia: row.nomeFantasia != null ? String(row.nomeFantasia) : undefined,
                                    });
                                })];
                    }
                });
            });
        };
        /**
         * Lista naturezas de operação. Se empresaId for informado, retorna naturezas da empresa ou globais (empresa IS NULL).
         */
        PedidoDataService_1.prototype.listNaturezas = function (empresaId) {
            return __awaiter(this, void 0, void 0, function () {
                var tablesToTry, lastError, _i, tablesToTry_2, table, empCol, query, _a, data, error;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            tablesToTry = ['naturezaOperacao', 'natureza_operacao', 'naturezas_operacao'];
                            lastError = null;
                            _i = 0, tablesToTry_2 = tablesToTry;
                            _b.label = 1;
                        case 1:
                            if (!(_i < tablesToTry_2.length)) return [3 /*break*/, 4];
                            table = tablesToTry_2[_i];
                            empCol = table === 'natureza_operacao' ? 'empresa_id' : 'empresa';
                            query = this.getClient().from(table).select('*').order('id');
                            if (empresaId != null && empresaId > 0) {
                                query = query.or("".concat(empCol, ".eq.").concat(empresaId, ",").concat(empCol, ".is.null"));
                            }
                            return [4 /*yield*/, query];
                        case 2:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (!error) {
                                return [2 /*return*/, (data !== null && data !== void 0 ? data : []).map(function (row) {
                                        var _a, _b;
                                        var emp = row.empresa != null ? Number(row.empresa) : (row.empresa_id != null ? Number(row.empresa_id) : null);
                                        return {
                                            id: Number(row.id),
                                            descricao: String((_b = (_a = row.descricao) !== null && _a !== void 0 ? _a : row.nome) !== null && _b !== void 0 ? _b : ''),
                                            empresa: emp,
                                        };
                                    })];
                            }
                            lastError = error.message;
                            if (!error.message.includes('does not exist') && !error.message.includes('relation') && !error.message.includes('42P01')) {
                                return [3 /*break*/, 4];
                            }
                            _b.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4: throw new Error("naturezaOperacao list: ".concat(lastError !== null && lastError !== void 0 ? lastError : 'tabela não encontrada'));
                    }
                });
            });
        };
        PedidoDataService_1.prototype.getNaturezaTable = function () {
            return __awaiter(this, void 0, void 0, function () {
                var tablesToTry, _i, tablesToTry_3, table, error;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            tablesToTry = ['naturezaOperacao', 'natureza_operacao', 'naturezas_operacao'];
                            _i = 0, tablesToTry_3 = tablesToTry;
                            _a.label = 1;
                        case 1:
                            if (!(_i < tablesToTry_3.length)) return [3 /*break*/, 4];
                            table = tablesToTry_3[_i];
                            return [4 /*yield*/, this.getClient().from(table).select('id').limit(1)];
                        case 2:
                            error = (_a.sent()).error;
                            if (!error)
                                return [2 /*return*/, table];
                            _a.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4: return [2 /*return*/, 'naturezaOperacao'];
                    }
                });
            });
        };
        /**
         * Cria uma natureza de operação. Retorna o registro inserido com id.
         */
        PedidoDataService_1.prototype.createNaturezaOperacao = function (payload) {
            return __awaiter(this, void 0, void 0, function () {
                var table, aliquotaFunruralVal, empresaNum, empresaVal, row, _a, data, error;
                var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6;
                return __generator(this, function (_7) {
                    switch (_7.label) {
                        case 0: return [4 /*yield*/, this.getNaturezaTable()];
                        case 1:
                            table = _7.sent();
                            aliquotaFunruralVal = (_b = payload.aliquotaFunrural) !== null && _b !== void 0 ? _b : payload.aliquota_funrural;
                            empresaNum = (payload.empresa != null && payload.empresa !== ''
                                ? Number(payload.empresa)
                                : (payload.empresa_id != null && payload.empresa_id !== '' ? Number(payload.empresa_id) : null));
                            empresaVal = empresaNum != null && !Number.isNaN(empresaNum) && empresaNum > 0 ? empresaNum : null;
                            row = {
                                descricao: (_c = payload.descricao) !== null && _c !== void 0 ? _c : '',
                                serie: (_d = payload.serie) !== null && _d !== void 0 ? _d : '1',
                                tipo: (_e = payload.tipo) !== null && _e !== void 0 ? _e : 'saida',
                                cod_regimeTributario: (_g = (_f = payload.cod_regimeTributario) !== null && _f !== void 0 ? _f : payload.cod_regime_tributario) !== null && _g !== void 0 ? _g : null,
                                indicadorPresenca: (_j = (_h = payload.indicadorPresenca) !== null && _h !== void 0 ? _h : payload.indicador_presenca) !== null && _j !== void 0 ? _j : null,
                                fatura: (_l = (_k = payload.fatura) !== null && _k !== void 0 ? _k : payload.faturada) !== null && _l !== void 0 ? _l : null,
                                consumidorFinal: (_o = (_m = payload.consumidorFinal) !== null && _m !== void 0 ? _m : payload.consumidor_final) !== null && _o !== void 0 ? _o : true,
                                operacao_devolucao: (_q = (_p = payload.operacao_devolucao) !== null && _p !== void 0 ? _p : payload.operacaoDevolucao) !== null && _q !== void 0 ? _q : false,
                                infoAdicionais: (_s = (_r = payload.infoAdicionais) !== null && _r !== void 0 ? _r : payload.info_adicionais) !== null && _s !== void 0 ? _s : null,
                                naturezaPadrao: (_u = (_t = payload.naturezaPadrao) !== null && _t !== void 0 ? _t : payload.natureza_padrao) !== null && _u !== void 0 ? _u : null,
                                presumido_pis_cofins: (_w = (_v = payload.presumidoPisCofins) !== null && _v !== void 0 ? _v : payload.presumido_pis_cofins) !== null && _w !== void 0 ? _w : null,
                                somar_outras_despesas: (_y = (_x = payload.somarOutrasDespesas) !== null && _x !== void 0 ? _x : payload.somar_outras_despesas) !== null && _y !== void 0 ? _y : null,
                                aliquota_funrural: aliquotaFunruralVal != null && aliquotaFunruralVal !== ''
                                    ? Number(aliquotaFunruralVal)
                                    : null,
                                compra_produtor_rural: (_0 = (_z = payload.compraProdutorRural) !== null && _z !== void 0 ? _z : payload.compra_produtor_rural) !== null && _0 !== void 0 ? _0 : null,
                                descontar_funrural: (_2 = (_1 = payload.descontarFunrural) !== null && _1 !== void 0 ? _1 : payload.descontar_funrural) !== null && _2 !== void 0 ? _2 : null,
                                tipo_perc_aprox_trib: (_4 = (_3 = payload.tipoPercAproxTrib) !== null && _3 !== void 0 ? _3 : payload.tipo_perc_aprox_trib) !== null && _4 !== void 0 ? _4 : null,
                                tipo_desconto: (_6 = (_5 = payload.tipoDesconto) !== null && _5 !== void 0 ? _5 : payload.tipo_desconto) !== null && _6 !== void 0 ? _6 : null,
                                incluir_frete_base_ipi: payload.incluirFreteBaseIpi !== undefined && payload.incluirFreteBaseIpi !== null
                                    ? Boolean(payload.incluirFreteBaseIpi)
                                    : true,
                            };
                            if (table === 'natureza_operacao') {
                                row.empresa_id = empresaVal;
                            }
                            else {
                                row.empresa = empresaVal;
                            }
                            return [4 /*yield*/, this.getClient()
                                    .from(table)
                                    .insert(row)
                                    .select('*')
                                    .single()];
                        case 2:
                            _a = _7.sent(), data = _a.data, error = _a.error;
                            if (error)
                                throw new Error("naturezaOperacao insert: ".concat(error.message));
                            return [2 /*return*/, data];
                    }
                });
            });
        };
        /**
         * Atualiza uma natureza de operação por id.
         */
        PedidoDataService_1.prototype.updateNaturezaOperacao = function (id, payload) {
            return __awaiter(this, void 0, void 0, function () {
                var table, aliquotaFunruralVal, empresaNum, empresaVal, row, _a, data, error;
                var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6;
                return __generator(this, function (_7) {
                    switch (_7.label) {
                        case 0: return [4 /*yield*/, this.getNaturezaTable()];
                        case 1:
                            table = _7.sent();
                            aliquotaFunruralVal = (_b = payload.aliquotaFunrural) !== null && _b !== void 0 ? _b : payload.aliquota_funrural;
                            empresaNum = (payload.empresa != null && payload.empresa !== ''
                                ? Number(payload.empresa)
                                : (payload.empresa_id != null && payload.empresa_id !== '' ? Number(payload.empresa_id) : null));
                            empresaVal = empresaNum != null && !Number.isNaN(empresaNum) && empresaNum > 0 ? empresaNum : null;
                            row = {
                                descricao: (_c = payload.descricao) !== null && _c !== void 0 ? _c : '',
                                serie: (_d = payload.serie) !== null && _d !== void 0 ? _d : '1',
                                tipo: (_e = payload.tipo) !== null && _e !== void 0 ? _e : 'saida',
                                cod_regimeTributario: (_g = (_f = payload.cod_regimeTributario) !== null && _f !== void 0 ? _f : payload.cod_regime_tributario) !== null && _g !== void 0 ? _g : null,
                                indicadorPresenca: (_j = (_h = payload.indicadorPresenca) !== null && _h !== void 0 ? _h : payload.indicador_presenca) !== null && _j !== void 0 ? _j : null,
                                fatura: (_l = (_k = payload.fatura) !== null && _k !== void 0 ? _k : payload.faturada) !== null && _l !== void 0 ? _l : null,
                                consumidorFinal: (_o = (_m = payload.consumidorFinal) !== null && _m !== void 0 ? _m : payload.consumidor_final) !== null && _o !== void 0 ? _o : true,
                                operacao_devolucao: (_q = (_p = payload.operacao_devolucao) !== null && _p !== void 0 ? _p : payload.operacaoDevolucao) !== null && _q !== void 0 ? _q : false,
                                infoAdicionais: (_s = (_r = payload.infoAdicionais) !== null && _r !== void 0 ? _r : payload.info_adicionais) !== null && _s !== void 0 ? _s : null,
                                naturezaPadrao: (_u = (_t = payload.naturezaPadrao) !== null && _t !== void 0 ? _t : payload.natureza_padrao) !== null && _u !== void 0 ? _u : null,
                                presumido_pis_cofins: (_w = (_v = payload.presumidoPisCofins) !== null && _v !== void 0 ? _v : payload.presumido_pis_cofins) !== null && _w !== void 0 ? _w : null,
                                somar_outras_despesas: (_y = (_x = payload.somarOutrasDespesas) !== null && _x !== void 0 ? _x : payload.somar_outras_despesas) !== null && _y !== void 0 ? _y : null,
                                aliquota_funrural: aliquotaFunruralVal != null && aliquotaFunruralVal !== ''
                                    ? Number(aliquotaFunruralVal)
                                    : null,
                                compra_produtor_rural: (_0 = (_z = payload.compraProdutorRural) !== null && _z !== void 0 ? _z : payload.compra_produtor_rural) !== null && _0 !== void 0 ? _0 : null,
                                descontar_funrural: (_2 = (_1 = payload.descontarFunrural) !== null && _1 !== void 0 ? _1 : payload.descontar_funrural) !== null && _2 !== void 0 ? _2 : null,
                                tipo_perc_aprox_trib: (_4 = (_3 = payload.tipoPercAproxTrib) !== null && _3 !== void 0 ? _3 : payload.tipo_perc_aprox_trib) !== null && _4 !== void 0 ? _4 : null,
                                tipo_desconto: (_6 = (_5 = payload.tipoDesconto) !== null && _5 !== void 0 ? _5 : payload.tipo_desconto) !== null && _6 !== void 0 ? _6 : null,
                                incluir_frete_base_ipi: payload.incluirFreteBaseIpi !== undefined && payload.incluirFreteBaseIpi !== null
                                    ? Boolean(payload.incluirFreteBaseIpi)
                                    : true,
                            };
                            if (table === 'natureza_operacao') {
                                row.empresa_id = empresaVal;
                            }
                            else {
                                row.empresa = empresaVal;
                            }
                            return [4 /*yield*/, this.getClient()
                                    .from(table)
                                    .update(row)
                                    .eq('id', id)
                                    .select('*')
                                    .single()];
                        case 2:
                            _a = _7.sent(), data = _a.data, error = _a.error;
                            if (error)
                                throw new Error("naturezaOperacao update: ".concat(error.message));
                            return [2 /*return*/, data];
                    }
                });
            });
        };
        /**
         * Persiste regras tributárias para uma natureza (naturezaRef = naturezaId).
         * Remove regras existentes e insere as do payload. Regras vazias = apenas delete.
         */
        PedidoDataService_1.prototype.saveRegrasForNatureza = function (naturezaId, regras) {
            return __awaiter(this, void 0, void 0, function () {
                var client, natRef, deleteByNatureza, list, _i, _a, r, tables, _b, tables_2, table, error, _c, _d, r, error, _e, _f, r, error, _g, _h, r, error, retList, ret, error, _j, _k, r, error, _l, _m, r, error, _o, _p, r, error;
                var _this = this;
                var _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37;
                return __generator(this, function (_38) {
                    switch (_38.label) {
                        case 0:
                            client = this.getClient();
                            natRef = naturezaId;
                            deleteByNatureza = function (tableOrTables, col) { return __awaiter(_this, void 0, void 0, function () {
                                var tables, _i, tables_3, table, error;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            tables = Array.isArray(tableOrTables) ? tableOrTables : [tableOrTables];
                                            _i = 0, tables_3 = tables;
                                            _a.label = 1;
                                        case 1:
                                            if (!(_i < tables_3.length)) return [3 /*break*/, 4];
                                            table = tables_3[_i];
                                            return [4 /*yield*/, client.from(table).delete().eq(col, natRef)];
                                        case 2:
                                            error = (_a.sent()).error;
                                            if (error && !error.message.includes('does not exist') && !error.message.includes('relation')) {
                                                throw new Error("".concat(table, " delete: ").concat(error.message));
                                            }
                                            _a.label = 3;
                                        case 3:
                                            _i++;
                                            return [3 /*break*/, 1];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); };
                            list = function (arr) { return Array.isArray(arr) ? arr : []; };
                            return [4 /*yield*/, deleteByNatureza(['regrasICMS', 'regrasicms'], 'naturezaRef')];
                        case 1:
                            _38.sent();
                            _i = 0, _a = list(regras.icms);
                            _38.label = 2;
                        case 2:
                            if (!(_i < _a.length)) return [3 /*break*/, 7];
                            r = _a[_i];
                            tables = ['regrasICMS', 'regrasicms'];
                            _b = 0, tables_2 = tables;
                            _38.label = 3;
                        case 3:
                            if (!(_b < tables_2.length)) return [3 /*break*/, 6];
                            table = tables_2[_b];
                            return [4 /*yield*/, client.from(table).insert({
                                    naturezaRef: natRef,
                                    destinos: (_q = r.destinos) !== null && _q !== void 0 ? _q : 'Qualquer',
                                    cfop: (_r = r.cfop) !== null && _r !== void 0 ? _r : null,
                                    aliquota_icms: (_t = (_s = r.aliquota_icms) !== null && _s !== void 0 ? _s : r.aliquota) !== null && _t !== void 0 ? _t : null,
                                    situacaoTributaria: (_v = (_u = r.situacaoTributaria) !== null && _u !== void 0 ? _u : r.situacao_tributaria) !== null && _v !== void 0 ? _v : null,
                                    base_calculo_percentual: (_x = (_w = r.base_calculo_percentual) !== null && _w !== void 0 ? _w : r.base) !== null && _x !== void 0 ? _x : 100,
                                })];
                        case 4:
                            error = (_38.sent()).error;
                            if (!error)
                                return [3 /*break*/, 6];
                            if (error.message.includes('does not exist') || error.message.includes('relation'))
                                return [3 /*break*/, 5];
                            throw new Error("regrasICMS insert: ".concat(error.message));
                        case 5:
                            _b++;
                            return [3 /*break*/, 3];
                        case 6:
                            _i++;
                            return [3 /*break*/, 2];
                        case 7: return [4 /*yield*/, deleteByNatureza('regrasPIS', 'naturezaRef')];
                        case 8:
                            _38.sent();
                            _c = 0, _d = list(regras.pis);
                            _38.label = 9;
                        case 9:
                            if (!(_c < _d.length)) return [3 /*break*/, 12];
                            r = _d[_c];
                            return [4 /*yield*/, client.from('regrasPIS').insert({
                                    naturezaRef: natRef,
                                    destinos: (_y = r.destinos) !== null && _y !== void 0 ? _y : 'Qualquer',
                                    aliquota: (_z = r.aliquota) !== null && _z !== void 0 ? _z : null,
                                    base: (_0 = r.base) !== null && _0 !== void 0 ? _0 : 100,
                                    situacaoTributaria: (_2 = (_1 = r.situacaoTributaria) !== null && _1 !== void 0 ? _1 : r.situacao_tributaria) !== null && _2 !== void 0 ? _2 : null,
                                })];
                        case 10:
                            error = (_38.sent()).error;
                            if (error)
                                throw new Error("regrasPIS insert: ".concat(error.message));
                            _38.label = 11;
                        case 11:
                            _c++;
                            return [3 /*break*/, 9];
                        case 12: return [4 /*yield*/, deleteByNatureza('regrasCOFINS', 'naturezaRef')];
                        case 13:
                            _38.sent();
                            _e = 0, _f = list(regras.cofins);
                            _38.label = 14;
                        case 14:
                            if (!(_e < _f.length)) return [3 /*break*/, 17];
                            r = _f[_e];
                            return [4 /*yield*/, client.from('regrasCOFINS').insert({
                                    naturezaRef: natRef,
                                    destinos: (_3 = r.destinos) !== null && _3 !== void 0 ? _3 : 'Qualquer',
                                    aliquota: (_4 = r.aliquota) !== null && _4 !== void 0 ? _4 : null,
                                    base: (_5 = r.base) !== null && _5 !== void 0 ? _5 : 100,
                                    situacaoTributaria: (_7 = (_6 = r.situacaoTributaria) !== null && _6 !== void 0 ? _6 : r.situacao_tributaria) !== null && _7 !== void 0 ? _7 : null,
                                })];
                        case 15:
                            error = (_38.sent()).error;
                            if (error)
                                throw new Error("regrasCOFINS insert: ".concat(error.message));
                            _38.label = 16;
                        case 16:
                            _e++;
                            return [3 /*break*/, 14];
                        case 17: return [4 /*yield*/, deleteByNatureza('regrasIPI', 'naturezaRef')];
                        case 18:
                            _38.sent();
                            _g = 0, _h = list(regras.ipi);
                            _38.label = 19;
                        case 19:
                            if (!(_g < _h.length)) return [3 /*break*/, 22];
                            r = _h[_g];
                            return [4 /*yield*/, client.from('regrasIPI').insert({
                                    naturezaRef: natRef,
                                    destinos: (_8 = r.destinos) !== null && _8 !== void 0 ? _8 : 'Qualquer',
                                    aliq: (_10 = (_9 = r.aliq) !== null && _9 !== void 0 ? _9 : r.aliquota) !== null && _10 !== void 0 ? _10 : null,
                                    codEnquadramento: (_12 = (_11 = r.codEnquadramento) !== null && _11 !== void 0 ? _11 : r.cod_enquadramento) !== null && _12 !== void 0 ? _12 : null,
                                    situacaoTributaria: (_14 = (_13 = r.situacaoTributaria) !== null && _13 !== void 0 ? _13 : r.situacao_tributaria) !== null && _14 !== void 0 ? _14 : null,
                                })];
                        case 20:
                            error = (_38.sent()).error;
                            if (error)
                                throw new Error("regrasIPI insert: ".concat(error.message));
                            _38.label = 21;
                        case 21:
                            _g++;
                            return [3 /*break*/, 19];
                        case 22: return [4 /*yield*/, deleteByNatureza('regrasRETENCOES', 'naturezaRef')];
                        case 23:
                            _38.sent();
                            retList = list(regras.retencoes);
                            if (!(retList.length > 0)) return [3 /*break*/, 25];
                            ret = retList[0];
                            return [4 /*yield*/, client.from('regrasRETENCOES').insert({
                                    naturezaRef: natRef,
                                    possui_retencao_csrf: (_16 = (_15 = ret.possui_retencao_csrf) !== null && _15 !== void 0 ? _15 : ret.possuiRetencaoCsrf) !== null && _16 !== void 0 ? _16 : false,
                                    aliquota_csrf: (_18 = (_17 = ret.aliquota_csrf) !== null && _17 !== void 0 ? _17 : ret.aliquotaCsrf) !== null && _18 !== void 0 ? _18 : null,
                                    possui_retencao_ir: (_20 = (_19 = ret.possui_retencao_ir) !== null && _19 !== void 0 ? _19 : ret.possuiRetencaoIr) !== null && _20 !== void 0 ? _20 : false,
                                    aliquota_ir: (_22 = (_21 = ret.aliquota_ir) !== null && _21 !== void 0 ? _21 : ret.aliquotaIr) !== null && _22 !== void 0 ? _22 : null,
                                })];
                        case 24:
                            error = (_38.sent()).error;
                            if (error)
                                throw new Error("regrasRETENCOES insert: ".concat(error.message));
                            _38.label = 25;
                        case 25: return [4 /*yield*/, deleteByNatureza('regrasis', 'naturezaRef')];
                        case 26:
                            _38.sent();
                            _j = 0, _k = list(regras.is);
                            _38.label = 27;
                        case 27:
                            if (!(_j < _k.length)) return [3 /*break*/, 30];
                            r = _k[_j];
                            return [4 /*yield*/, client.from('regrasis').insert({
                                    naturezaRef: natRef,
                                    destinos: (_23 = r.destinos) !== null && _23 !== void 0 ? _23 : 'Qualquer',
                                    aliquota: (_24 = r.aliquota) !== null && _24 !== void 0 ? _24 : null,
                                    base: (_25 = r.base) !== null && _25 !== void 0 ? _25 : 100,
                                    situacaoTributaria: (_27 = (_26 = r.situacaoTributaria) !== null && _26 !== void 0 ? _26 : r.situacao_tributaria) !== null && _27 !== void 0 ? _27 : null,
                                })];
                        case 28:
                            error = (_38.sent()).error;
                            if (error)
                                throw new Error("regrasis insert: ".concat(error.message));
                            _38.label = 29;
                        case 29:
                            _j++;
                            return [3 /*break*/, 27];
                        case 30: return [4 /*yield*/, deleteByNatureza('regrasibs', 'naturezaRef')];
                        case 31:
                            _38.sent();
                            _l = 0, _m = list(regras.ibs);
                            _38.label = 32;
                        case 32:
                            if (!(_l < _m.length)) return [3 /*break*/, 35];
                            r = _m[_l];
                            return [4 /*yield*/, client.from('regrasibs').insert({
                                    naturezaRef: natRef,
                                    destinos: (_28 = r.destinos) !== null && _28 !== void 0 ? _28 : 'Qualquer',
                                    aliquota: (_29 = r.aliquota) !== null && _29 !== void 0 ? _29 : null,
                                    base: (_30 = r.base) !== null && _30 !== void 0 ? _30 : 100,
                                    situacaoTributaria: (_32 = (_31 = r.situacaoTributaria) !== null && _31 !== void 0 ? _31 : r.situacao_tributaria) !== null && _32 !== void 0 ? _32 : null,
                                })];
                        case 33:
                            error = (_38.sent()).error;
                            if (error)
                                throw new Error("regrasibs insert: ".concat(error.message));
                            _38.label = 34;
                        case 34:
                            _l++;
                            return [3 /*break*/, 32];
                        case 35: return [4 /*yield*/, deleteByNatureza('regrascbs', 'naturezaRef')];
                        case 36:
                            _38.sent();
                            _o = 0, _p = list(regras.cbs);
                            _38.label = 37;
                        case 37:
                            if (!(_o < _p.length)) return [3 /*break*/, 40];
                            r = _p[_o];
                            return [4 /*yield*/, client.from('regrascbs').insert({
                                    naturezaRef: natRef,
                                    destinos: (_33 = r.destinos) !== null && _33 !== void 0 ? _33 : 'Qualquer',
                                    aliquota: (_34 = r.aliquota) !== null && _34 !== void 0 ? _34 : null,
                                    base: (_35 = r.base) !== null && _35 !== void 0 ? _35 : 100,
                                    situacaoTributaria: (_37 = (_36 = r.situacaoTributaria) !== null && _36 !== void 0 ? _36 : r.situacao_tributaria) !== null && _37 !== void 0 ? _37 : null,
                                })];
                        case 38:
                            error = (_38.sent()).error;
                            if (error)
                                throw new Error("regrascbs insert: ".concat(error.message));
                            _38.label = 39;
                        case 39:
                            _o++;
                            return [3 /*break*/, 37];
                        case 40: return [2 /*return*/];
                    }
                });
            });
        };
        /** Busca produtos por nome (para autocomplete no formulário de NF). */
        PedidoDataService_1.prototype.searchProdutosPorNome = function (q_1) {
            return __awaiter(this, arguments, void 0, function (q, limit) {
                var term, _a, data, error;
                if (limit === void 0) { limit = 20; }
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            term = String(q || '').trim();
                            if (!term)
                                return [2 /*return*/, []];
                            return [4 /*yield*/, this.getClient()
                                    .from('produtos')
                                    .select('id, nome, sku, preco')
                                    .ilike('nome', '%' + term + '%')
                                    .limit(limit)];
                        case 1:
                            _a = _b.sent(), data = _a.data, error = _a.error;
                            if (error)
                                return [2 /*return*/, []];
                            return [2 /*return*/, (data !== null && data !== void 0 ? data : []).map(function (row) { return ({
                                    id: Number(row.id),
                                    nome: row.nome != null ? String(row.nome) : null,
                                    sku: row.sku != null ? String(row.sku) : null,
                                    preco: row.preco != null ? Number(row.preco) : null,
                                }); })];
                    }
                });
            });
        };
        return PedidoDataService_1;
    }());
    __setFunctionName(_classThis, "PedidoDataService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PedidoDataService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PedidoDataService = _classThis;
}();
exports.PedidoDataService = PedidoDataService;
