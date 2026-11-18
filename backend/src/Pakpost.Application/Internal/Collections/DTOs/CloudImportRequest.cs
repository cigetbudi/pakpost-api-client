using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed record CloudImportRequest(string Name, string Method, string Url, string HeadersJson,
    string Body, string BodyMode = "raw", string ContentType = "application/json",
    string FormFieldsJson = "[]", string PreRequestScript = "", string PostResponseScript = "", List<string>? FolderPath = null);
