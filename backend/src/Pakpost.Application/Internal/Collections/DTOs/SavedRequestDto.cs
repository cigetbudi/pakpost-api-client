using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed record SavedRequestDto(Guid Id, Guid CollectionId, string Name, string Method, string Url, string HeadersJson, string Body,
    string BodyMode, string ContentType, string FormFieldsJson, string PreRequestScript, string PostResponseScript, int Revision, Guid? FolderId = null);
