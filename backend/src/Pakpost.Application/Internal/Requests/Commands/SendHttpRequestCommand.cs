using Mediator;
using Pakpost.Application.Internal.Requests.DTOs;

namespace Pakpost.Application.Internal.Requests.Commands;

public sealed record SendHttpRequestCommand(
    string Method, string Url, Dictionary<string, string>? Headers, string? Body,
    string? BodyMode = null, string? ContentType = null, List<HttpFormField>? FormFields = null,
    string? FileBase64 = null, string? FileName = null):IRequest<SendHttpResponse>;
